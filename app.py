import os

from dotenv import load_dotenv
from flask import Flask, jsonify, render_template

from routes import api
from simulation.events import advance_simulation, get_container_history
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

    @app.get("/demo/yard")
    def yard_map_demo():
        return render_template("demo/yard_map.html")

    @app.get("/demo/containers")
    def containers_demo():
        return render_template("demo/containers.html")

    @app.get("/demo/equipment")
    def equipment_demo():
        return render_template("demo/equipment.html")

    @app.get("/demo/trucks")
    def trucks_demo():
        return render_template("demo/trucks.html")

    @app.get("/demo/workforce")
    def workforce_demo():
        return render_template("demo/workforce.html")

    @app.get("/demo/credential-scan")
    def credential_scan_demo():
        return render_template(
            "demo/credential_scan.html"
        )

    @app.errorhandler(404)
    def not_found(_error):
        return jsonify({"error": "Route not found"}), 404

    @app.errorhandler(405)
    def method_not_allowed(_error):
        return jsonify({"error": "Method not allowed"}), 405

    @app.get("/api/demo/state")
    def demo_state_view():
        return jsonify(demo_state), 200

    @app.get("/api/demo/containers/<container_id>/history")
    def demo_container_history(container_id):
        if container_id not in demo_state["containers"]:
            return jsonify(
                {
                    "error": "Container not found",
                    "container_id": container_id,
                }
            ), 404

        history = get_container_history(
            demo_state,
            container_id,
        )

        return jsonify(
            {
                "container_id": container_id,
                "current_status": demo_state["containers"][
                    container_id
                ]["status"],
                "history": history,
            }
        ), 200

    @app.post("/api/demo/reset")
    def demo_reset():
        demo_state.clear()
        demo_state.update(create_initial_state())
        return jsonify(demo_state), 200

    @app.post("/api/demo/step")
    def demo_step():
        result = advance_simulation(demo_state)

        return jsonify(
            {
                "result": result,
                "state": demo_state,
            }
        ), 200

    return app


app = create_app()


if __name__ == "__main__":
    port = int(os.getenv("PORT", "5000"))
    debug = os.getenv("FLASK_DEBUG", "false").lower() == "true"
    app.run(host="127.0.0.1", port=port, debug=debug)
