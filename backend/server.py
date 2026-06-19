import os
from flask import Flask, send_from_directory
from werkzeug.serving import BaseWSGIServer, make_server

_FRONTEND_DIR = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "frontend"))


def create_app() -> Flask:
    app = Flask(__name__)

    @app.route("/")
    def index():
        return send_from_directory(_FRONTEND_DIR, "index.html")

    @app.route("/<path:filename>")
    def static_files(filename: str):
        return send_from_directory(_FRONTEND_DIR, filename)

    return app


def make_flask_server(host: str, port: int) -> BaseWSGIServer:
    return make_server(host, port, create_app())
