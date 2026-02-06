from flask import Flask, request, jsonify, send_from_directory
import os
import json
from datetime import datetime

app = Flask(__name__)

BASE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'files')

if not os.path.exists(BASE_DIR):
    os.makedirs(BASE_DIR)

def get_full_path(relative_path):
    full_path = os.path.normpath(os.path.join(BASE_DIR, relative_path))
    if not full_path.startswith(os.path.normpath(BASE_DIR)):
        return None
    return full_path

def get_file_info(file_path):
    try:
        stat = os.stat(file_path)
        return {
            'name': os.path.basename(file_path),
            'path': os.path.relpath(file_path, BASE_DIR),
            'size': stat.st_size,
            'created': datetime.fromtimestamp(stat.st_ctime).isoformat(),
            'modified': datetime.fromtimestamp(stat.st_mtime).isoformat(),
            'is_file': os.path.isfile(file_path),
            'is_dir': os.path.isdir(file_path)
        }
    except Exception as e:
        return None

@app.route('/api/files', methods=['GET'])
def list_files():
    try:
        subpath = request.args.get('path', '')
        full_path = get_full_path(subpath)
        
        if not full_path or not os.path.exists(full_path):
            return jsonify({'error': 'Directory not found'}), 404
        
        if not os.path.isdir(full_path):
            return jsonify({'error': 'Path is not a directory'}), 400
        
        items = []
        for item in os.listdir(full_path):
            item_path = os.path.join(full_path, item)
            info = get_file_info(item_path)
            if info:
                items.append(info)
        
        return jsonify({
            'current_path': subpath,
            'items': items,
            'base_dir': BASE_DIR
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/read', methods=['GET'])
def read_file():
    try:
        relative_path = request.args.get('path', '')
        full_path = get_full_path(relative_path)
        
        if not full_path:
            return jsonify({'error': 'Invalid path'}), 400
        
        if not os.path.exists(full_path):
            return jsonify({'error': 'File not found'}), 404
        
        if not os.path.isfile(full_path):
            return jsonify({'error': 'Path is not a file'}), 400
        
        ext = os.path.splitext(full_path)[1].lower()
        if ext not in ['.txt', '.md']:
            return jsonify({'error': 'Only .txt and .md files are supported'}), 400
        
        with open(full_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        return jsonify({
            'path': relative_path,
            'content': content,
            'size': len(content),
            'encoding': 'utf-8'
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/write', methods=['POST'])
def write_file():
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        relative_path = data.get('path', '')
        content = data.get('content', '')
        
        if not relative_path:
            return jsonify({'error': 'Path is required'}), 400
        
        ext = os.path.splitext(relative_path)[1].lower()
        if ext not in ['.txt', '.md']:
            return jsonify({'error': 'Only .txt and .md files are supported'}), 400
        
        full_path = get_full_path(relative_path)
        if not full_path:
            return jsonify({'error': 'Invalid path'}), 400
        
        os.makedirs(os.path.dirname(full_path), exist_ok=True)
        
        with open(full_path, 'w', encoding='utf-8') as f:
            f.write(content)
        
        return jsonify({
            'message': 'File written successfully',
            'path': relative_path,
            'size': len(content)
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/create', methods=['POST'])
def create_file():
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        relative_path = data.get('path', '')
        content = data.get('content', '')
        
        if not relative_path:
            return jsonify({'error': 'Path is required'}), 400
        
        ext = os.path.splitext(relative_path)[1].lower()
        if ext not in ['.txt', '.md']:
            return jsonify({'error': 'Only .txt and .md files are supported'}), 400
        
        full_path = get_full_path(relative_path)
        if not full_path:
            return jsonify({'error': 'Invalid path'}), 400
        
        if os.path.exists(full_path):
            return jsonify({'error': 'File already exists'}), 409
        
        os.makedirs(os.path.dirname(full_path), exist_ok=True)
        
        with open(full_path, 'w', encoding='utf-8') as f:
            f.write(content)
        
        return jsonify({
            'message': 'File created successfully',
            'path': relative_path,
            'size': len(content)
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/delete', methods=['DELETE'])
def delete_file():
    try:
        relative_path = request.args.get('path', '')
        full_path = get_full_path(relative_path)
        
        if not full_path:
            return jsonify({'error': 'Invalid path'}), 400
        
        if not os.path.exists(full_path):
            return jsonify({'error': 'File not found'}), 404
        
        if os.path.isdir(full_path):
            os.rmdir(full_path)
        else:
            os.remove(full_path)
        
        return jsonify({
            'message': 'Deleted successfully',
            'path': relative_path
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/info', methods=['GET'])
def file_info():
    try:
        relative_path = request.args.get('path', '')
        full_path = get_full_path(relative_path)
        
        if not full_path or not os.path.exists(full_path):
            return jsonify({'error': 'File not found'}), 404
        
        info = get_file_info(full_path)
        if info:
            return jsonify(info)
        else:
            return jsonify({'error': 'Could not get file info'}), 500
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    print(f"File server starting...")
    print(f"Base directory: {BASE_DIR}")
    print(f"API endpoints:")
    print(f"  GET  /api/files?path=<relative_path>  - List directory contents")
    print(f"  GET  /api/read?path=<relative_path>   - Read file content")
    print(f"  POST /api/write                       - Write/create file")
    print(f"  POST /api/create                      - Create new file")
    print(f"  DELETE /api/delete?path=<relative_path> - Delete file/directory")
    print(f"  GET  /api/info?path=<relative_path>   - Get file information")
    print(f"\nSupported file types: .txt, .md")
    
    app.run(host='0.0.0.0', port=5000, debug=True)
