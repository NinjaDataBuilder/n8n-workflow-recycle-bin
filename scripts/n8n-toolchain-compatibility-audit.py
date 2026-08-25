#!/usr/bin/env python3
"""Read-only compatibility gate for the NinjaDataBuilder n8n toolchain."""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "scripts" / "n8n-toolchain-compatibility.json"

TOOLS = {
    "recycleBin": (ROOT, ["npm", "test"]),
    "recycleBinCli": (ROOT / "cli", ["npm", "test"]),
    "googleTagManager": (Path("/home/ubuntu/ninjadatabuilder-n8n-nodes-google-tag-manager"), ["npm", "test"]),
    "metaAds": (Path("/home/ubuntu/ninjadatabuilder-meta-ads"), ["npm", "test"]),
    "baserowSchemaAdmin": (Path("/home/ubuntu/ninjadatabuilder-baserow-schema"), ["npm", "test"]),
}


def run(command: list[str], cwd: Path, timeout: int = 600) -> tuple[int, str]:
    try:
        p = subprocess.run(command, cwd=cwd, text=True, capture_output=True, timeout=timeout)
        return p.returncode, (p.stdout + p.stderr)[-3000:]
    except Exception as exc:
        return 1, repr(exc)


def live_n8n_version(container: str) -> str:
    code, out = run(["sudo", "docker", "exec", container, "n8n", "--version"], Path("/home/ubuntu"), 60)
    if code != 0:
        raise RuntimeError(f"unable to read live n8n version: {out.strip()}")
    return out.strip().splitlines()[-1]


def latest_n8n_release() -> str | None:
    try:
        with urllib.request.urlopen("https://api.github.com/repos/n8n-io/n8n/releases/latest", timeout=20) as response:
            data = json.load(response)
        if data.get("prerelease"):
            return None
        return str(data.get("tag_name", "")).removeprefix("n8n@") or None
    except Exception:
        return None


def package_version(path: Path) -> str:
    data = json.loads((path / "package.json").read_text())
    return str(data.get("version", "unknown"))


def git_dirty(path: Path) -> bool:
    code, out = run(["git", "status", "--porcelain"], path, 60)
    return code != 0 or bool(out.strip())


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--container", default="databuilder-n8n-editor")
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()

    manifest = json.loads(MANIFEST.read_text())
    version = live_n8n_version(args.container)
    expected = manifest.get("versions", {}).get(version)
    latest = latest_n8n_release()
    report: dict = {
        "n8nVersion": version,
        "latestStableN8n": latest,
        "manifestKnown": bool(expected),
        "tools": {},
        "alerts": [],
    }

    if not expected:
        report["alerts"].append(f"n8n {version} não possui matriz de compatibilidade; bloquear release.")
    elif latest and latest != version:
        report["alerts"].append(f"n8n live={version}, stable={latest}; preparar upgrade controlado antes de publicar ferramentas.")

    for name, (path, command) in TOOLS.items():
        item = {"path": str(path), "exists": path.is_dir()}
        if not path.is_dir():
            item["status"] = "missing"
            report["alerts"].append(f"repositório ausente: {name}")
            report["tools"][name] = item
            continue
        item["version"] = package_version(path)
        item["gitDirty"] = git_dirty(path)
        if expected and name in expected:
            item["expectedVersion"] = expected[name]
        code, output = run(command, path)
        item["testExitCode"] = code
        item["testOutputTail"] = output
        item["status"] = "ok" if code == 0 else "failed"
        if code != 0:
            report["alerts"].append(f"testes falharam: {name}")
        if item.get("gitDirty"):
            item["status"] = "dirty" if code == 0 else "failed-dirty"
        if expected and name in expected and item["version"] != expected[name]:
            report["alerts"].append(f"versão divergente em {name}: local={item['version']} esperado={expected[name]}")
        report["tools"][name] = item

    report["status"] = "ok" if not report["alerts"] else "alert"
    if args.json:
        print(json.dumps(report, ensure_ascii=False, indent=2))
    elif report["alerts"]:
        print("ALERTA TOOLCHAIN N8N")
        print("\n".join(f"- {alert}" for alert in report["alerts"]))
    return 0 if report["status"] == "ok" else 1


if __name__ == "__main__":
    sys.exit(main())
