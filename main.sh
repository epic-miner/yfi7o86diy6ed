
#!/bin/bash

# Create directory structure
mkdir -p admin

# Install dependencies
pip install --user -r requirements.txt

echo "Anime Database API with Admin Panel"
echo "-----------------------------------"
echo "Your API is running at /api"
echo "Access the Admin Panel at /admin"
echo "API Key for admin operations: 7291826614"
