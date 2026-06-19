import os
from flask import Flask, request, jsonify, send_from_directory
from werkzeug.serving import BaseWSGIServer, make_server

from backend.cpm import compute, validate_activities

_FRONTEND_DIR = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "frontend"))


def create_app() -> Flask:
    app = Flask(__name__)

    @app.route("/")
    def index():
        return send_from_directory(_FRONTEND_DIR, "index.html")

    @app.route("/<path:filename>")
    def static_files(filename: str):
        return send_from_directory(_FRONTEND_DIR, filename)

    @app.post("/api/compute")
    def api_compute():
        body = request.get_json(silent=True)
        if not isinstance(body, list):
            return jsonify({"error": "Expected a JSON array of activities"}), 400
        errors = validate_activities(body)
        if errors:
            return jsonify({"errors": errors}), 422
        try:
            result = compute(body)
        except Exception as e:
            return jsonify({"error": str(e)}), 500
        return jsonify(result)

    return app


def make_flask_server(host: str, port: int) -> BaseWSGIServer:
    return make_server(host, port, create_app())
