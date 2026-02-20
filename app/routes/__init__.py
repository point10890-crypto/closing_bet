# app/routes/__init__.py
"""Blueprint Registration"""

from flask import Blueprint


def register_blueprints(app):
    """Register all Blueprints"""

    # Common API routes
    from app.routes.common import common_bp
    app.register_blueprint(common_bp, url_prefix='/api')

    # KR Market routes
    from app.routes.kr_market import kr_bp
    app.register_blueprint(kr_bp, url_prefix='/api/kr')

    # US Market routes
    from app.routes.us_market import us_bp
    app.register_blueprint(us_bp, url_prefix='/api/us')

    # Crypto routes
    from app.routes.crypto import crypto_bp
    app.register_blueprint(crypto_bp, url_prefix='/api/crypto')

    # Economy routes
    from app.routes.econ import econ_bp
    app.register_blueprint(econ_bp, url_prefix='/api/econ')

    # Dividend routes
    from app.routes.dividend import dividend_bp
    app.register_blueprint(dividend_bp, url_prefix='/api/dividend')

    # Auth routes
    from app.routes.auth import auth_bp
    app.register_blueprint(auth_bp, url_prefix='/api/auth')

    # Stripe routes
    from app.routes.stripe_routes import stripe_bp
    app.register_blueprint(stripe_bp, url_prefix='/api/stripe')

    print("[OK] All Blueprints registered (KR + US + Crypto + Econ + Dividend + Auth + Stripe)")
