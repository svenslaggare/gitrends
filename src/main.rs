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
    let config: WebAppConfig = serde_yaml::from_str(
        &std::fs::read_to_string(args.config).unwrap()
    ).unwrap();
    setup_logger().unwrap();

    web::app::main(config).await;
}

fn setup_logger() -> Result<(), fern::InitError> {
    fern::Dispatch::new()
        .format(|out, message, record| {
            out.finish(format_args!(
                "[{} {} {}] {}",
                chrono::Local::now().format("%Y-%m-%d %H:%M:%S"),
                record.level(),
                record.target(),
                message
            ))
        })
        .level(log::LevelFilter::Info)
        .chain(std::io::stdout())
        .apply()?;
    Ok(())
}