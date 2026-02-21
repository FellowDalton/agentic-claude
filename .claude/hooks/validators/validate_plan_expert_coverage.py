#!/usr/bin/env python3

"""
Validates that all team members in a plan have valid Expert fields.

Hook Type: Stop

Checks:
1. Find the most recently created/modified file in the specified directory
2. Locate the "### Team Members" section
3. For each "- Builder" block, verify an "Expert:" line exists
4. Validate each Expert value matches /skills:<domain>:plan_build_improve

Exit codes:
- 0: Validation passed (all builders have valid Expert fields)
- 1: Validation failed (missing or invalid Expert fields)

Usage:
  python3 validate_plan_expert_coverage.py -d specs -e .md
  python3 validate_plan_expert_coverage.py --directory specs --extension .md --max-age 10

Frontmatter example:
  hooks:
    Stop:
      - hooks:
          - type: command
            command: "python3 $CLAUDE_PROJECT_DIR/.claude/hooks/validators/validate_plan_expert_coverage.py --directory specs --extension .md"
"""

import argparse
import json
import logging
import re
import subprocess
import sys
import time
from pathlib import Path

# Logging setup - log file next to this script (SAME NAME)
SCRIPT_DIR = Path(__file__).parent
LOG_FILE = SCRIPT_DIR / "validate_plan_expert_coverage.log"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    handlers=[logging.FileHandler(LOG_FILE, mode='a')]
)
logger = logging.getLogger(__name__)

# Constants
DEFAULT_DIRECTORY = "specs"
DEFAULT_EXTENSION = ".md"
DEFAULT_MAX_AGE_MINUTES = 5

EXPERT_PATTERN = re.compile(r"^/skills:[a-z0-9-]+:plan_build_improve$")

NO_FILE_ERROR = (
    "VALIDATION FAILED: No new file found matching {pattern}.\n\n"
    "ACTION REQUIRED: Use the Write tool to create a new file in the {directory}/ directory. "
    "The file must be created before this validation can pass. "
    "Do not stop until the file has been created."
)

MISSING_EXPERT_ERROR = (
    "VALIDATION FAILED: Team member '{name}' is missing a valid Expert field. "
    "Every team member must have Expert: /skills:<domain>:plan_build_improve. "
    "If no expert exists, add a prerequisite task using /create-expert-skill to bootstrap one."
)

INVALID_EXPERT_ERROR = (
    "VALIDATION FAILED: Team member '{name}' has invalid Expert value '{value}'. "
    "Expected format: /skills:<domain>:plan_build_improve (regex: /skills:[a-z0-9-]+:plan_build_improve). "
    "If no expert exists for this domain, add a prerequisite task using /create-expert-skill to bootstrap one."
)

NO_TEAM_SECTION_ERROR = (
    "VALIDATION FAILED: No '### Team Members' section found in '{file}'.\n\n"
    "ACTION REQUIRED: Add a '### Team Members' section with Builder entries that include Expert fields."
)


def get_git_untracked_files(directory: str, extension: str) -> list[str]:
    """Get list of untracked files in directory from git."""
    try:
        result = subprocess.run(
            ["git", "status", "--porcelain", f"{directory}/"],
            capture_output=True,
            text=True,
            timeout=5
        )
        if result.returncode != 0:
            logger.info(f"git status returned non-zero: {result.returncode}")
            return []

        untracked = []
        for line in result.stdout.strip().split('\n'):
            if not line:
                continue
            status = line[:2]
            filepath = line[3:].strip()

            if status in ('??', 'A ', ' A', 'AM') and filepath.endswith(extension):
                untracked.append(filepath)

        logger.info(f"Git untracked files: {untracked}")
        return untracked
    except (subprocess.TimeoutExpired, subprocess.SubprocessError) as e:
        logger.warning(f"Git command failed: {e}")
        return []


def get_recent_files(directory: str, extension: str, max_age_minutes: int) -> list[str]:
    """Get list of files in directory modified within the last N minutes."""
    target_dir = Path(directory)
    if not target_dir.exists():
        return []

    recent = []
    now = time.time()
    max_age_seconds = max_age_minutes * 60

    ext = extension if extension.startswith('.') else f'.{extension}'
    pattern = f"*{ext}"

    for filepath in target_dir.glob(pattern):
        try:
            mtime = filepath.stat().st_mtime
            age = now - mtime
            if age <= max_age_seconds:
                recent.append(str(filepath))
        except OSError:
            continue

    return recent


def find_newest_file(directory: str, extension: str, max_age_minutes: int) -> str | None:
    """
    Find the most recently created/modified file in directory.

    Returns:
        Path to the newest file, or None if no recent files found.
    """
    git_new = get_git_untracked_files(directory, extension)
    recent_files = get_recent_files(directory, extension, max_age_minutes)

    all_files = list(set(git_new + recent_files))

    if not all_files:
        return None

    newest = None
    newest_mtime = 0

    for filepath in all_files:
        try:
            path = Path(filepath)
            if path.exists():
                mtime = path.stat().st_mtime
                if mtime > newest_mtime:
                    newest_mtime = mtime
                    newest = str(path)
        except OSError:
            continue

    return newest


def parse_team_members(content: str) -> list[dict]:
    """
    Parse Builder blocks from the Team Members section.

    Returns list of dicts with 'name' and 'expert' keys.
    """
    # Find the Team Members section
    team_section_match = re.search(r'### Team Members\s*\n', content)
    if not team_section_match:
        return []

    # Extract content from Team Members to next h2/h3 or end
    start = team_section_match.end()
    next_section = re.search(r'\n## ', content[start:])
    if next_section:
        section_content = content[start:start + next_section.start()]
    else:
        section_content = content[start:]

    # Parse Builder blocks
    members = []
    # Normalize: ensure leading newline so split works uniformly
    normalized = '\n' + section_content if not section_content.startswith('\n') else section_content
    builder_blocks = re.split(r'\n- Builder\b', normalized)

    for block in builder_blocks[1:]:  # Skip content before first Builder
        name_match = re.search(r'- Name:\s*(.+)', block)
        expert_match = re.search(r'- Expert:\s*(.+)', block)

        name = name_match.group(1).strip() if name_match else "<unknown>"
        expert = expert_match.group(1).strip() if expert_match else None

        members.append({
            'name': name,
            'expert': expert
        })

    return members


def validate_expert_coverage(filepath: str) -> tuple[bool, str]:
    """
    Validate that all team members have valid Expert fields.

    Returns:
        tuple: (success: bool, message: str)
    """
    try:
        content = Path(filepath).read_text(encoding='utf-8')
    except (OSError, UnicodeDecodeError) as e:
        logger.error(f"Failed to read file {filepath}: {e}")
        return False, f"Failed to read file {filepath}: {e}"

    # Check for Team Members section
    if '### Team Members' not in content:
        msg = NO_TEAM_SECTION_ERROR.format(file=filepath)
        logger.warning(f"FAIL: {msg}")
        return False, msg

    members = parse_team_members(content)

    if not members:
        logger.info(f"No Builder entries found in {filepath} - passing (no builders to validate)")
        return True, f"No Builder entries found in '{filepath}' (nothing to validate)"

    logger.info(f"Found {len(members)} Builder entries")

    errors = []
    for member in members:
        name = member['name']
        expert = member['expert']

        if not expert:
            errors.append(MISSING_EXPERT_ERROR.format(name=name))
            logger.warning(f"FAIL: Builder '{name}' has no Expert field")
            continue

        if not EXPERT_PATTERN.match(expert):
            errors.append(INVALID_EXPERT_ERROR.format(name=name, value=expert))
            logger.warning(f"FAIL: Builder '{name}' has invalid Expert: {expert}")

    if errors:
        combined = "\n\n".join(errors)
        return False, combined

    msg = f"All {len(members)} team members in '{filepath}' have valid Expert fields"
    logger.info(f"PASS: {msg}")
    return True, msg


def parse_args() -> argparse.Namespace:
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(
        description="Validate that plan team members have valid Expert coverage"
    )
    parser.add_argument(
        '-d', '--directory',
        type=str,
        default=DEFAULT_DIRECTORY,
        help=f'Directory to check for plan files (default: {DEFAULT_DIRECTORY})'
    )
    parser.add_argument(
        '-e', '--extension',
        type=str,
        default=DEFAULT_EXTENSION,
        help=f'File extension to match (default: {DEFAULT_EXTENSION})'
    )
    parser.add_argument(
        '--max-age',
        type=int,
        default=DEFAULT_MAX_AGE_MINUTES,
        help=f'Maximum file age in minutes (default: {DEFAULT_MAX_AGE_MINUTES})'
    )
    return parser.parse_args()


def main():
    """Main entry point for the validator."""
    logger.info("=" * 60)
    logger.info("Validator started: validate_plan_expert_coverage")

    try:
        args = parse_args()
        logger.info(f"Args: directory={args.directory}, extension={args.extension}, max_age={args.max_age}")

        # Read hook input from stdin (if provided)
        try:
            input_data = json.load(sys.stdin)
            logger.info(f"Stdin input received: {len(json.dumps(input_data))} bytes")
        except (json.JSONDecodeError, EOFError):
            input_data = {}
            logger.info("No stdin input or invalid JSON")

        # Find the newest file
        pattern = f"{args.directory}/*{args.extension}"
        newest_file = find_newest_file(args.directory, args.extension, args.max_age)

        if not newest_file:
            msg = NO_FILE_ERROR.format(pattern=pattern, directory=args.directory)
            logger.warning(f"FAIL: {msg}")
            result = {"result": "block", "reason": msg}
            print(json.dumps(result))
            sys.exit(1)

        logger.info(f"Found newest file: {newest_file}")

        # Validate expert coverage
        success, message = validate_expert_coverage(newest_file)

        if success:
            result = {"result": "continue", "message": message}
            logger.info(f"Result: CONTINUE - {message}")
            print(json.dumps(result))
            sys.exit(0)
        else:
            result = {"result": "block", "reason": message}
            logger.info(f"Result: BLOCK")
            print(json.dumps(result))
            sys.exit(1)

    except Exception as e:
        # On error, allow through but log
        logger.exception(f"Validation error: {e}")
        print(json.dumps({
            "result": "continue",
            "message": f"Validation error (allowing through): {str(e)}"
        }))
        sys.exit(0)


if __name__ == "__main__":
    main()
