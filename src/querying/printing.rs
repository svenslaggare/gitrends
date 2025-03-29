pub struct TablePrinter {
    column_names: Vec<String>,
    rows: Vec<Vec<String>>
}

impl TablePrinter {
    pub fn new(column_names: Vec<String>) -> TablePrinter {
        TablePrinter {
            column_names,
            rows: Vec::new()
        }
    }

    pub fn add_row(&mut self, row: Vec<String>) {
        assert_eq!(self.column_names.len(), row.len());
        self.rows.push(row);
    }

    pub fn print(&mut self) {
        let mut column_lengths = vec![0; self.column_names.len()];
        for (column_index, column) in self.column_names.iter().enumerate() {
            column_lengths[column_index] = column_lengths[column_index].max(column.len() + 2);
        }

        for row in &self.rows {
            for (column_index, column) in row.iter().enumerate() {
                column_lengths[column_index] = column_lengths[column_index].max(column.len() + 2);
            }
        }

        let print_chars = |c: char, n: usize| {
            for _ in 0..n {
                print!("{}", c);
            }
        };

        print_chars('-', column_lengths.iter().map(|l| l + 1).sum::<usize>() - 1);
        println!();

        for (column_index, column) in self.column_names.iter().enumerate() {
            let length = column_lengths[column_index] - (column.len() + 2);

            print_chars(' ', length / 2);
            print!(" {} ", column);
            print_chars(' ', length / 2 + length % 2);

            if column_index != self.column_names.len() - 1 {
                print!("|");
            }
        }

        println!();

        let mut first = true;
        for length in &column_lengths {
            if !first {
                print!("+");
            } else {
                first = false;
            }

            print_chars('-', *length);
        }
        println!();

        for row in &self.rows {
            for (column_index, column) in row.iter().enumerate() {
                print!(" {} ", column);

                print_chars(' ', column_lengths[column_index] - (column.len() + 2));

                if column_index != self.column_names.len() - 1 {
                    print!("|");
                }
            }

            println!();
        }
    }
}

pub trait TablePrinting {
    fn get_column_names() -> Vec<String>;
    fn add_row(&self, table_printer: &mut TablePrinter);

    fn create_printer<'a>(items: impl Iterator<Item=&'a Self>) -> TablePrinter where Self: Sized, Self: 'a {
        let mut printer = TablePrinter::new(Self::get_column_names());

        for change_coupling in items {
            change_coupling.add_row(&mut printer);
        }

        printer
    }
}

pub trait PrintAsTable {
    fn print_as_table(&self);
}

impl<T: TablePrinting> PrintAsTable for Vec<T> {
    fn print_as_table(&self) {
        T::create_printer(self.iter()).print();
    }
}