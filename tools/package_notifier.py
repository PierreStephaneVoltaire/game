import argparse
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path


def package(destination: Path) -> None:
    if sys.version_info[:2] != (3, 11):
        raise RuntimeError("Package with Python 3.11 to match the notifier runtime")
    root = Path(__file__).resolve().parents[1]
    with tempfile.TemporaryDirectory() as temporary:
        staging = Path(temporary) / "notifier"
        shutil.copytree(root / "notifier", staging, ignore=shutil.ignore_patterns("__pycache__", "tests"))
        shutil.copytree(root / "api/backend", staging / "backend", ignore=shutil.ignore_patterns("__pycache__"))
        subprocess.run([sys.executable, "-m", "pip", "install", "--target", str(staging / ".python_packages/lib/site-packages"), "-r", str(staging / "requirements.txt")], check=True)
        archive = shutil.make_archive(str(Path(temporary) / "notifier"), "zip", staging)
        shutil.copyfile(archive, destination)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("destination", type=Path)
    package(parser.parse_args().destination)
