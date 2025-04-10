use std::path::Path;
use std::sync::Arc;

use datafusion::arrow::array::{as_primitive_array, ArrayRef, BooleanArray, Float64Array, StringViewArray};
use datafusion::arrow::datatypes::{DataType, Int64Type};
use datafusion::common::cast::as_string_array;
use datafusion::logical_expr::{create_udf, ColumnarValue, Volatility};
use datafusion::prelude::*;

use crate::querying::extras::{AuthorNormalizer, IgnoreFile, ModuleDefinitions};
use crate::querying::{QueryingResult};

pub fn add(data_directory: &Path, ctx: &SessionContext) -> QueryingResult<()> {
    let ignore_file = match std::fs::read_to_string(data_directory.join("ignore.txt")) {
        Ok(definition) => IgnoreFile::new(&definition),
        _ => IgnoreFile::empty()
    };

    let is_ignored = create_udf(
        "is_ignored",
        vec![DataType::Utf8],
        DataType::Boolean,
        Volatility::Immutable,
        Arc::new(move |args: &[ColumnarValue]| {
            let args = ColumnarValue::values_to_arrays(args)?;
            let file_name = as_string_array(&args[0]).expect("cast failed");

            let array = file_name
                .iter()
                .map(|file_name| {
                    file_name.map(|file_name| {
                        ignore_file.is_ignored(file_name)
                    })
                })
                .collect::<BooleanArray>();

            Ok(ColumnarValue::from(Arc::new(array) as ArrayRef))
        })
    );
    ctx.register_udf(is_ignored.clone());

    let module_definitions = match std::fs::read_to_string(data_directory.join("modules.txt")) {
        Ok(definition) => ModuleDefinitions::new(&definition)?,
        _ => ModuleDefinitions::empty()
    };

    let extract_module_name = create_udf(
        "extract_module_name",
        vec![DataType::Utf8],
        DataType::Utf8View,
        Volatility::Immutable,
        Arc::new(move |args: &[ColumnarValue]| {
            let args = ColumnarValue::values_to_arrays(args)?;
            let file_name = as_string_array(&args[0]).expect("cast failed");

            let array = file_name
                .iter()
                .map(|file_name| {
                    file_name.map(|file_name| {
                        if let Some(module_name) = module_definitions.get_module(file_name) {
                            return module_name.to_owned();
                        }

                        if let Some(parent) = Path::new(file_name).parent() {
                            let parent = parent.to_str().unwrap().to_owned();
                            if !parent.is_empty() {
                                parent
                            } else {
                                "<root>".to_owned()
                            }
                        } else {
                            file_name.to_owned()
                        }
                    })
                })
                .collect::<StringViewArray>();

            Ok(ColumnarValue::from(Arc::new(array) as ArrayRef))
        })
    );
    ctx.register_udf(extract_module_name.clone());

    let author_normalizer = match std::fs::read_to_string(data_directory.join("authors.txt")) {
        Ok(definition) => AuthorNormalizer::new(&definition)?,
        _ => AuthorNormalizer::empty()
    };

    let normalize_author = create_udf(
        "normalize_author",
        vec![DataType::Utf8],
        DataType::Utf8View,
        Volatility::Immutable,
        Arc::new(move |args: &[ColumnarValue]| {
            let args = ColumnarValue::values_to_arrays(args)?;
            let author = as_string_array(&args[0]).expect("cast failed");

            let array = author
                .iter()
                .map(|file_name| {
                    file_name.map(|author| {
                        author_normalizer.normalize(author).unwrap_or(author).to_owned()
                    })
                })
                .collect::<StringViewArray>();

            Ok(ColumnarValue::from(Arc::new(array) as ArrayRef))
        })
    );
    ctx.register_udf(normalize_author.clone());

    let ratio = create_udf(
        "ratio",
        vec![DataType::Int64, DataType::Int64],
        DataType::Float64,
        Volatility::Immutable,
        Arc::new(move |args: &[ColumnarValue]| {
            let args = ColumnarValue::values_to_arrays(args)?;
            let arg0 = as_primitive_array::<Int64Type>(&args[0]);
            let arg1 = as_primitive_array::<Int64Type>(&args[1]);

            let array = arg0.iter().zip(arg1.iter())
                .map(|(arg0, arg1)| {
                    match (arg0, arg1) {
                        (Some(arg0), Some(arg1)) => {
                            if arg1 != 0 {
                                Some(arg0 as f64 / arg1 as f64)
                            } else {
                                Some(0.0)
                            }
                        }
                        _ => None
                    }
                })
                .collect::<Float64Array>();

            Ok(ColumnarValue::from(Arc::new(array) as ArrayRef))
        })
    );
    ctx.register_udf(ratio.clone());

    Ok(())
}