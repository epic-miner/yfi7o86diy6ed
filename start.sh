
#!/bin/bash

# Print banner
echo "======================================"
echo "      Anime Database Admin Panel      "
echo "======================================"
echo

# Make sure script is executable
chmod +x start.sh

# Function to check if a package is installed
check_package() {
  pip show $1 > /dev/null 2>&1
  return $?
}

# Check and install dependencies
echo "Checking dependencies..."

# Create requirements.txt if it doesn't exist
if [ ! -f requirements.txt ]; then
  echo "Creating requirements.txt..."
  echo "requests==2.31.0" > requirements.txt
  echo "flask==3.1.0" >> requirements.txt
fi

# Check if requirements are installed
missing_packages=false

# Read requirements.txt line by line
while IFS= read -r line || [ -n "$line" ]; do
  # Skip empty lines
  [ -z "$line" ] && continue
  
  # Extract package name (remove version info)
  package=$(echo $line | cut -d'=' -f1)
  
  # Check if package is installed
  if ! check_package $package; then
    echo "Package '$package' is not installed."
    missing_packages=true
  else
    echo "Package '$package' is already installed. ✓"
  fi
done < requirements.txt

# Install missing packages if any
if [ "$missing_packages" = true ]; then
  echo
  echo "Installing missing packages..."
  pip install -r requirements.txt
  echo "All packages have been installed. ✓"
else
  echo "All required packages are already installed. ✓"
fi

echo
echo "Starting Anime Database Admin Panel..."
echo "======================================"
echo "Access the admin panel at: http://localhost:8080/admin"
echo "API proxy is running at: http://localhost:8080/api"
echo "======================================"
echo
echo "Press Ctrl+C to stop the server"
echo

# Start the server
python server.py
