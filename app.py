import os
import secrets

from dotenv import load_dotenv
from flask import Flask, jsonify, redirect, render_template, request, url_for

from auth import COMMAND_CENTER_ROLES, current_user, login_required, roles_required
from auth import auth
from routes import api
from simulation.events import advance_simulation, get_container_history
from simulation.vessel_state import create_initial_state
from worker_portal import worker_portal


def create_app():
    load_dotenv()

    app = Flask(__name__)
    app.config["JSON_SORT_KEYS"] = False
    app.config["SECRET_KEY"] = os.getenv("SECRET_KEY") or secrets.token_hex(32)
    app.config["SESSION_COOKIE_HTTPONLY"] = True
    app.config["SESSION_COOKIE_SAMESITE"] = "Strict"
    app.config["SESSION_COOKIE_SECURE"] = (
        os.getenv("SESSION_COOKIE_SECURE", "false").lower() == "true"
    )
    app.config["PERMANENT_SESSION_LIFETIME"] = 3600

    app.register_blueprint(api, url_prefix="/api")
    app.register_blueprint(auth, url_prefix="/api/auth")
    app.register_blueprint(worker_portal, url_prefix="/api/worker")
    demo_state = create_initial_state()

    @app.get("/login")
    def login_page():
        user = current_user()
        if user is not None:
            if user["role_code"] == "OPERATOR":
                return redirect(url_for("operator_screen"))
            return redirect(url_for("command_center"))
        return render_template("login.html")

    @app.get("/")
    @roles_required(*COMMAND_CENTER_ROLES)
    def command_center():
        return render_template("command_center.html", current_user=current_user())

    @app.get("/operator")
    @roles_required("OPERATOR", "SUPERVISOR", "DISPATCHER", "ADMIN")
    def operator_screen():
        return render_template("operator.html", current_user=current_user())

    @app.get("/demo")
    @login_required
    def live_terminal_demo():
        return render_template("demo/vessel_operations.html")

    @app.get("/demo/yard")
    @roles_required(*COMMAND_CENTER_ROLES)
    def yard_map_demo():
        return render_template("demo/yard_map.html")

    @app.get("/demo/containers")
    @roles_required(*COMMAND_CENTER_ROLES)
    def containers_demo():
        return render_template("demo/containers.html")

    @app.get("/demo/equipment")
    @roles_required(*COMMAND_CENTER_ROLES)
    def equipment_demo():
        return render_template("demo/equipment.html")

    @app.get("/demo/trucks")
    @roles_required(*COMMAND_CENTER_ROLES)
    def trucks_demo():
        return render_template("demo/trucks.html")

    @app.get("/demo/workforce")
    @roles_required(*COMMAND_CENTER_ROLES)
    def workforce_demo():
        return render_template("demo/workforce.html")

    @app.get("/demo/assignments")
    @roles_required(*COMMAND_CENTER_ROLES)
    def assignments_demo():
        return render_template("demo/assignments.html")

    @app.get("/demo/credential-scan")
    @login_required
    def credential_scan_demo():
        return render_template("demo/credential_scan.html")

    @app.get("/demo/access-history")
    @roles_required("SECURITY", "SUPERVISOR", "ADMIN")
    def access_history_demo():
        return render_template("demo/access_history.html")

    @app.errorhandler(404)
    def not_found(_error):
        return jsonify({"error": "Route not found"}), 404

    @app.errorhandler(405)
    def method_not_allowed(_error):
        return jsonify({"error": "Method not allowed"}), 405

    @app.get("/api/demo/state")
    @login_required
    def demo_state_view():
        return jsonify(demo_state), 200

    @app.get("/api/demo/containers/<container_id>/history")
    @login_required
    def demo_container_history(container_id):
        if container_id not in demo_state["containers"]:
            return jsonify(
                {"error": "Container not found", "container_id": container_id}
            ), 404

        history = get_container_history(demo_state, container_id)
        return jsonify(
            {
                "container_id": container_id,
                "current_status": demo_state["containers"][container_id]["status"],
                "history": history,
            }
        ), 200

    @app.post("/api/demo/reset")
    @roles_required("SUPERVISOR", "DISPATCHER", "ADMIN")
    def demo_reset():
        demo_state.clear()
        demo_state.update(create_initial_state())
        return jsonify(demo_state), 200

    @app.post("/api/demo/step")
    @roles_required("SUPERVISOR", "DISPATCHER", "ADMIN")
    def demo_step():
        result = advance_simulation(demo_state)
        return jsonify({"result": result, "state": demo_state}), 200

    return app


app = create_app()


if __name__ == "__main__":
    port = int(os.getenv("PORT", "5000"))
    debug = os.getenv("FLASK_DEBUG", "false").lower() == "true"
    app.run(host="127.0.0.1", port=port, debug=debug)
