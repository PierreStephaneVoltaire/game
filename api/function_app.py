import azure.functions as func

from backend.auth.routes import bp as auth
from backend.content.routes import bp as content
from backend.games.routes import bp as games
from backend.http import endpoint

app = func.FunctionApp(http_auth_level=func.AuthLevel.ANONYMOUS)
app.register_functions(auth)
app.register_functions(games)
app.register_functions(content)


@app.route(route="health", methods=["GET"])
@endpoint
def health(_: func.HttpRequest) -> dict[str, str]:
    return {"status": "ok"}
