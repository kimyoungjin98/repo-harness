#!/usr/bin/env python3
"""Build the skill's distributable rules from the maintained docs directory."""

import argparse
import hashlib
import json
from pathlib import Path
import re


ROOT = Path(__file__).resolve().parents[1]
SOURCES = (
    "main.md",
    "code-base.md",
    "code-base/front-end.md",
    "code-base/back-end.md",
    "code-base/design-system.md",
    "test.md",
    "git-branch.md",
    "document-write.md",
    "notifications.md",
    "codex-subscription.md",
    "evaluation.md",
)
OUTPUT = ROOT / "skills/repository-harness/references/rules"


def render(name, text):
    sections = re.split(r"(?=^## )", text, flags=re.MULTILINE)
    if name == "main.md":
        excluded = {"## Skills 활용", "## AGENTS.md", "## 여러 프로젝트별 구축 필요"}
        sections = [s for s in sections if s.splitlines()[0] not in excluded]
    if name == "evaluation.md":
        sections = [s for s in sections if not s.startswith("## 구성 스킬 실행 기록")]
    header = f"<!-- Generated from docs/{name} by scripts/build_skill.py. Edit the source document. -->\n\n"
    return (header + "".join(sections).rstrip() + "\n").encode("utf-8")


def expected_files():
    files = {}
    manifest = {"schema_version": 1, "source": "docs/", "files": {}}
    for name in SOURCES:
        source = (ROOT / "docs" / name).read_bytes()
        content = render(name, source.decode("utf-8"))
        files[name] = content
        manifest["files"][name] = {
            "source_sha256": hashlib.sha256(source).hexdigest(),
            "bundled_sha256": hashlib.sha256(content).hexdigest(),
        }
    files["manifest.json"] = (json.dumps(manifest, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
    return files


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Fail if the committed bundle differs from docs")
    args = parser.parse_args()
    expected = expected_files()
    # This directory contains generated output only; never follow an output symlink.
    for path in (OUTPUT, *OUTPUT.parents):
        if path == ROOT.parent:
            break
        if path.is_symlink():
            raise SystemExit(f"Refusing symlink output: {path}")
    actual = {}
    if OUTPUT.exists():
        for path in OUTPUT.rglob("*"):
            if path.is_symlink():
                raise SystemExit(f"Refusing symlink output: {path}")
            if path.is_file():
                actual[path.relative_to(OUTPUT).as_posix()] = path.read_bytes()
    differences = sorted(name for name in expected.keys() | actual.keys() if expected.get(name) != actual.get(name))
    if args.check:
        if differences:
            print("Bundle is out of date: " + ", ".join(differences))
            print("Run: python3 scripts/build_skill.py")
            return 1
        print("PASS: bundled rules match docs")
        return 0
    for name in actual.keys() - expected.keys():
        (OUTPUT / name).unlink()
    for name, content in expected.items():
        path = OUTPUT / name
        path.parent.mkdir(parents=True, exist_ok=True)
        if actual.get(name) != content:
            path.write_bytes(content)
    print(f"Built {len(SOURCES)} rule documents and manifest ({len(differences)} changed files)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
