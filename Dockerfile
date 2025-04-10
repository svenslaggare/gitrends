# Build the binaries & frontend
FROM ubuntu:24.04 AS builder
ARG FROM=ubuntu:24.04

RUN apt-get update && apt-get upgrade -y
RUN apt-get install -y --no-install-recommends ca-certificates curl g++ libssl-dev pkg-config

USER ubuntu

# Install rust toolchain
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs > /home/ubuntu/rust.sh ; sh /home/ubuntu/rust.sh -y
RUN /bin/bash -c "source ~/.cargo/env && cargo install cargo-deb"

# Install node
ENV NVM_DIR "/home/ubuntu/.nvm"
ENV NODE_VERSION 22.13.1
RUN mkdir $NVM_DIR
RUN curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
RUN . $NVM_DIR/nvm.sh && nvm install $NODE_VERSION && nvm alias default $NODE_VERSION && nvm use default && corepack enable
ENV PATH=$PATH:/home/ubuntu/.nvm/versions/node/v$NODE_VERSION/bin

RUN mkdir /home/ubuntu/build
WORKDIR /home/ubuntu/build

# This will cache dependencies
COPY --chown=ubuntu:ubuntu Cargo.toml /home/ubuntu/build
RUN /bin/bash -c "mkdir src && echo 'fn main() {}' > src/main.rs && echo '' > src/lib.rs"
RUN /bin/bash -c "source ~/.cargo/env && cargo build --release"

# Build frontend
COPY --chown=ubuntu:ubuntu frontend/static /home/ubuntu/build/frontend/static
RUN rm -rf /home/ubuntu/build/frontend/static/gitrends.js
WORKDIR /home/ubuntu/build/frontend
COPY --chown=ubuntu:ubuntu frontend /home/ubuntu/build/frontend
RUN yarn install --dev
RUN yarn webpack --config prod.webpack.config.js
WORKDIR /home/ubuntu/build

# Build main application
COPY --chown=ubuntu:ubuntu src /home/ubuntu/build/src
COPY --chown=ubuntu:ubuntu templates /home/ubuntu/build/templates
RUN /bin/bash -c "touch src/main.rs" && /bin/bash -c "touch src/lib.rs"

RUN /bin/bash -c "source ~/.cargo/env && cargo deb"

# Start from Ubuntu 24.04
FROM ubuntu:24.04

# Install dependencies
RUN apt-get update && apt-get install -y --no-install-recommends libssl-dev ca-certificates nano

# Install deb package
COPY --chown=ubuntu:ubuntu --from=builder /home/ubuntu/build/target/debian/gitrends_*.deb /home/ubuntu/gitrends.deb
RUN apt-get install -f /home/ubuntu/gitrends.deb

# Change user
USER ubuntu

WORKDIR /home/ubuntu/
ENTRYPOINT ["gitrends"]