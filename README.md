# Gitrends
Web-based behavior code analysis tool based on the work by Adam Tornhill in "Your Code as a Crime Scene".

Implemented analysis:

* Module decomposition
* Hotspot
* Change coupling
* Main developer
* Custom analysis in SQL

## How to install

### Using debian package
* Install the debian package from the released artifacts.
* Run as `gitrends <config>`

### As standalone binaries
* Download the standalone.zip.
* Unzip to a folder.
* Run as `./gitrends <config>`

## How to use
The configuration is defined in a YAML file:
```yaml
source_dir: /home/antjans/Code/sqlgrep
data_dir: data/sqlgrep
```

The `source_dir` is the repository to use, and the indexed repository is placed in `data_dir`. After indexing, the program no longer need to access the repository, and no source code is extracted to the index.

Then run `gitrends config.yaml` and then a goto http://localhost:9000 to access the web tool.

## How to build
Requirements:
* `cargo` (https://rustup.rs/)
* `yarn` (https://yarnpkg.com/getting-started/install)

Commands:
* Run `cargo build --release` to build web application.
* Go to `frontend` directory.
* Run `yarn install --dev` to install JavaScript dependencies.
* Run `./build_js.sh` to build frontend artifacts.

## Implementation details
The git log extracted as Parquet files, which then is used by Apache DataFusion to provide an querying engine on top of this data. This allows you to write custom SQL queries to query the underlying git data.