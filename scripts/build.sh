#!/bin/bash

# Create a build directory
mkdir -p build

# Copy all files from src to build
cp -R src/* build/

# Copy necessary files to the root for GitHub Pages
cp build/index.html .
cp build/style.css .
cp -R build/js .
cp -R build/data .

echo "Build completed successfully!"