use clap::Parser;

mod web;
mod querying;
mod indexing;

use web::app::WebAppConfig;

#[derive(Parser, Debug)]
#[command()]
struct Args {
    /// The config file
    #[arg()]
    config: String
}


#[tokio::main]
async fn main() {
    let args = Args::parse();
    let config: WebAppConfig = serde_yaml::from_str(&std::fs::read_to_string(args.config).unwrap()).unwrap();

    web::app::main(config).await;
}