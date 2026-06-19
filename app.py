import socket
import threading
import time

import webview

from backend.server import make_flask_server


def _find_free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def _wait_for_server(port: int, timeout: float = 10.0) -> None:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        try:
            with socket.create_connection(("127.0.0.1", port), timeout=0.1):
                return
        except OSError:
            time.sleep(0.05)
    raise RuntimeError(f"Server did not start within {timeout}s")


def main() -> None:
    port = _find_free_port()
    server = make_flask_server("127.0.0.1", port)

    server_thread = threading.Thread(target=server.serve_forever, daemon=True)
    server_thread.start()
    _wait_for_server(port)

    window = webview.create_window("PERT/CPM Tool", f"http://127.0.0.1:{port}")
    window.events.closed += server.shutdown
    webview.start()


if __name__ == "__main__":
    main()
