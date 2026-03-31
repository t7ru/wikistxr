#!/bin/bash
set -e

export RUSTFLAGS="-C target-feature=+simd128"

echo "Building..."
cargo build --target wasm32-unknown-unknown --release
wasm-bindgen --out-dir wasm --target web target/wasm32-unknown-unknown/release/wikistxr.wasm
wasm-opt -Oz --enable-bulk-memory --enable-simd -o wasm/wikistxr_bg.wasm wasm/wikistxr_bg.wasm

echo "Build complete, check wasm/"
