import os

from dotenv import load_dotenv
from flask import Flask, jsonify, render_template

from routes import api
from simulation.events import (
    discharge_container,
    place_container_in_yard,
    start_truck_transit,
)
from simulation.vessel_state import create_initial_state


def create_app():
    load_dotenv()

    app = Flask(__name__)
    app.config["JSON_SORT_KEYS"] = False
    app.register_blueprint(api, url_prefix="/api")
    demo_state = create_initial_state()

    @app.get("/")
    def command_center():
        return render_template("command_center.html")

    @app.get("/operator")
    def operator_screen():
        return render_template("operator.html")

    @app.get("/demo")
    def live_terminal_demo():
        return render_template("demo/vessel_operations.html")

    @app.errorhandler(404)
    def not_found(_error):
        return jsonify({"error": "Route not found"}), 404

    @app.errorhandler(405)
    def method_not_allowed(_error):
        return jsonify({"error": "Method not allowed"}), 405

    @app.get("/api/demo/state")
    def demo_state_view():
        return jsonify(demo_state), 200

    @app.post("/api/demo/reset")
    def demo_reset():
        demo_state.clear()
        demo_state.update(create_initial_state())
        return jsonify(demo_state), 200

    @app.post("/api/demo/step")
    def demo_step():
        container_id = "IH-C-1847"

        status = demo_state["containers"][container_id]["status"]

        if status == "ON_VESSEL":
            discharge_container(
                demo_state,
                container_id,
                "TT-17",
            )

        elif status == "ON_TRUCK":
            start_truck_transit(
                demo_state,
                container_id,
            )

        elif status == "IN_TRANSIT":
            place_container_in_yard(
                demo_state,
                container_id,
            )

        return jsonify(demo_state), 200

    return app


app = create_app()


if __name__ == "__main__":
    port = int(os.getenv("PORT", "5000"))
    debug = os.getenv("FLASK_DEBUG", "false").lower() == "true"
    app.run(host="127.0.0.1", port=port, debug=debug)
