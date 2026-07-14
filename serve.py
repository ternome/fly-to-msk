#!/usr/bin/env python3
"""Локальный превью: python3 serve.py [порт] (по умолчанию 4620)."""
import http.server
import os
import sys

os.chdir(os.path.dirname(os.path.abspath(__file__)))
port = int(sys.argv[1]) if len(sys.argv) > 1 else 4620

httpd = http.server.ThreadingHTTPServer(("127.0.0.1", port), http.server.SimpleHTTPRequestHandler)
print(f"serving on http://127.0.0.1:{port}")
httpd.serve_forever()
