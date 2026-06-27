#!/bin/bash
set -e

echo "Installing Python dependencies..."
pip install --upgrade pip
pip install -r requirements.txt

echo "Creating data directories..."
mkdir -p data uploads

echo "Build complete."
