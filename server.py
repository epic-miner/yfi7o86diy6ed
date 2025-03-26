from flask import Flask, render_template, send_from_directory, redirect

app = Flask(__name__)


# Serve the admin panel as the main page
@app.route('/')
def home():
    return redirect('/admin')


# Serve the admin directory files
@app.route('/admin')
def admin_home():
    return send_from_directory('admin', 'index.html')


@app.route('/admin/<path:path>')
def admin_files(path):
    return send_from_directory('admin', path)


# Serve static files directly for the admin panel
@app.route('/styles.css')
def styles():
    return send_from_directory('admin', 'styles.css')


@app.route('/script.js')
def script():
    return send_from_directory('admin', 'script.js')


# Forward API requests to the Cloudflare worker
@app.route('/api',
           defaults={'path': ''},
           methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'])
@app.route('/api/<path:path>',
           methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'])
def api(path):
    try:
        import requests
        from flask import request, Response, jsonify

        # Forward the request to your Cloudflare Worker
        worker_url = f"https://polished-river-de65.ahf626085.workers.dev/api/{path}"

        # Forward the request method, headers, and data
        headers = {
            key: value
            for key, value in request.headers if key != 'Host'
        }

        resp = requests.request(
            method=request.method,
            url=worker_url,
            headers=headers,
            data=request.get_data(),
            params=request.args,
            cookies=request.cookies,
            allow_redirects=False,
            timeout=10  # Add timeout to prevent hanging
        )

        # Create a Flask response object from the requests response
        response_headers = {
            key: value
            for key, value in resp.headers.items() if key not in
            ['Content-Length', 'Transfer-Encoding', 'Connection']
        }

        # Ensure proper content type is preserved
        content_type = resp.headers.get('Content-Type', '')
        if content_type:
            response_headers['Content-Type'] = content_type

        response = Response(resp.content, resp.status_code, response_headers)
        return response
    except ImportError:
        return jsonify({
            "error":
            "Required module 'requests' is not installed. Please install it with 'pip install requests'."
        }), 500
    except Exception as e:
        return jsonify({"error": f"API proxy error: {str(e)}"}), 500


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8080, debug=True)
