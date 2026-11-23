#!/usr/bin/env python3
"""Export tracked and non-ignored source as a Hostinger Node upload ZIP."""

import argparse
import datetime as dt
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import stat
import subprocess
import sys
import tempfile
import zipfile


MAX_FILES = 10000
MAX_FILE_BYTES = 20 * 1024 * 1024
MAX_SOURCE_BYTES = 100 * 1024 * 1024
MAX_ARCHIVE_BYTES = 50_000_000
EXCLUDED_DIRS = {
    '.git', 'node_modules', 'build', 'dist', '.next', '.hostinger-app',
    '.wrangler', '.vinext', '.sites-runtime', 'out', 'coverage', '__pycache__',
    '.pytest_cache', '.venv', 'venv', 'logs', 'backups', 'backup',
}
EXCLUDED_SUFFIXES = (
    '.zip', '.tar', '.tar.gz', '.tgz', '.gz', '.bz2', '.xz', '.7z', '.rar',
    '.db', '.db3', '.sqlite', '.sqlite3', '.sqlite-wal', '.sqlite-shm',
    '.db-wal', '.db-shm', '.log', '.pem', '.key', '.p12', '.pfx', '.jks',
    '.keystore', '.kdbx', '.ppk', '.sha256', '.tsbuildinfo', '.pyc',
)
PRIVATE_KEY = re.compile(rb'-----BEGIN (?:RSA |EC |DSA |OPENSSH |ENCRYPTED )?PRIVATE KEY-----')
GITHUB_TOKEN = re.compile(rb'\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{60,})\b')
SECRET_ENV_NAME = re.compile(r'(?:^|_)(?:PASSWORD|PASS|SECRET|TOKEN|API_KEY|PRIVATE_KEY|ACCESS_KEY)(?:_|$)')
PRIVATE_TEMPLATE_FIELDS = {'DB_NAME', 'DB_USER', 'SMTP_USER', 'SMTP_FROM', 'DB_SSL_CA_BASE64'}


class PackageError(Exception):
    pass


def git(source, *args):
    result = subprocess.run(['git', '-C', str(source), *args], stdout=subprocess.PIPE,
                            stderr=subprocess.PIPE, check=False)
    if result.returncode:
        raise PackageError('Could not read the local Git source metadata.')
    return result.stdout


def excluded(name):
    path = PurePosixPath(name)
    lower = path.name.lower()
    if any(part.lower() in EXCLUDED_DIRS for part in path.parts):
        return True
    if lower == '.env.example':
        return False
    if lower.startswith(('.env', '.dev.vars')):
        return True
    if lower.endswith(EXCLUDED_SUFFIXES) or '.log.' in lower:
        return True
    if lower in {'.ds_store', 'id_rsa', 'id_dsa', 'id_ecdsa', 'id_ed25519', 'credentials.json'}:
        return True
    if lower.startswith(('secrets.', 'service-account', 'service_account')):
        return True
    # Keep authored schema/migration SQL. Database exports are not source.
    if lower.endswith('.sql') and any(word in lower for word in ('dump', 'backup', 'export')):
        return True
    return False


def source_path(source, name):
    path = PurePosixPath(name)
    if path.is_absolute() or '..' in path.parts or '\\' in name:
        raise PackageError('Source contains an unsupported archive path.')
    current = source
    for part in path.parts:
        current = current / part
        if current.is_symlink():
            return None
    if not current.is_file():
        return None
    return current


def check_content(name, data):
    if PRIVATE_KEY.search(data) or GITHUB_TOKEN.search(data):
        raise PackageError('Credential-shaped content detected in source file: ' + name)
    if PurePosixPath(name).name.lower() != '.env.example':
        return
    try:
        lines = data.decode('utf-8').splitlines()
    except UnicodeDecodeError:
        raise PackageError('Environment examples must be UTF-8 text.') from None
    for line in lines:
        assignment = re.match(r'^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$', line)
        if not assignment:
            continue
        key, value = assignment.groups()
        key = key.upper()
        value = value.strip()
        if value.startswith('#'):
            value = ''
        if (SECRET_ENV_NAME.search(key) or key in PRIVATE_TEMPLATE_FIELDS) and value not in {'', '""', "''"}:
            raise PackageError('Environment example has a nonblank private field: ' + name + ' (' + key + ')')


def output_path(value, source, tracked):
    requested = Path(value).expanduser()
    if requested.is_symlink():
        raise PackageError('The output path must not be a symlink.')
    target = requested.absolute().resolve()
    if target.suffix.lower() != '.zip':
        raise PackageError('--output must name a .zip file.')
    try:
        relative = target.relative_to(source).as_posix()
    except ValueError:
        return target
    tracked_dirs = {parent.as_posix() for name in tracked
                    for parent in PurePosixPath(name).parents if parent.as_posix() != '.'}
    if relative in tracked or any(parent.as_posix() in tracked_dirs or parent.as_posix() in tracked
                                  for parent in PurePosixPath(relative).parents):
        raise PackageError('Place the ZIP outside tracked source paths, for example in an untracked outputs directory.')
    if any(part.lower() in {'.git', 'node_modules'} for part in PurePosixPath(relative).parts):
        raise PackageError('The output cannot be inside Git metadata or installed dependencies.')
    return target


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', required=True, help='Destination ZIP path.')
    parser.add_argument('--source', default=str(Path(__file__).resolve().parent.parent),
                        help='Git project root; defaults to this script\'s project.')
    args = parser.parse_args()
    source = Path(args.source).expanduser().absolute()
    if source.is_symlink():
        raise PackageError('The source root must not be a symlink.')
    source = source.resolve()
    top = Path(git(source, 'rev-parse', '--show-toplevel').decode().strip()).resolve()
    if top != source:
        raise PackageError('--source must be the Git project root.')
    tracked = {name.decode('utf-8') for name in git(source, 'ls-files', '-z', '--cached').split(b'\0') if name}
    names = {name.decode('utf-8') for name in git(source, 'ls-files', '-z', '--cached', '--others', '--exclude-standard').split(b'\0') if name}
    if len(names) > MAX_FILES:
        raise PackageError('Too many source files for one bounded upload package.')
    target = output_path(args.output, source, tracked)
    checksum_path = target.with_suffix('.zip.sha256')
    if checksum_path.is_symlink():
        raise PackageError('The checksum path must not be a symlink.')
    try:
        checksum_relative = checksum_path.relative_to(source).as_posix()
    except ValueError:
        checksum_relative = None
    if checksum_relative in tracked:
        raise PackageError('The checksum would overwrite a tracked source file.')
    commit = git(source, 'rev-parse', 'HEAD').decode().strip()
    dirty = bool(git(source, 'status', '--porcelain', '--untracked-files=normal').strip())
    stamp = int(git(source, 'show', '-s', '--format=%ct', 'HEAD').decode().strip())
    timestamp = dt.datetime.fromtimestamp(stamp, dt.timezone.utc)
    if not 1980 <= timestamp.year <= 2107:
        raise PackageError('Source commit timestamp is outside the ZIP date range.')
    date_time = timestamp.timetuple()[:6]

    files = {}
    total = 0
    for name in sorted(names):
        if excluded(name):
            continue
        path = source_path(source, name)
        if path is None:
            continue
        info = path.stat()
        if info.st_size > MAX_FILE_BYTES:
            raise PackageError('Source file exceeds the per-file upload bound: ' + name)
        data = path.read_bytes()
        if len(data) > MAX_FILE_BYTES or len(data) != info.st_size:
            raise PackageError('Source changed during packaging or exceeded its bound: ' + name)
        total += len(data)
        if total > MAX_SOURCE_BYTES:
            raise PackageError('Source exceeds the bounded upload package size.')
        # The exported npm configuration contains no registry credentials.
        if name != '.npmrc':
            check_content(name, data)
        files[name] = (data, stat.S_IMODE(info.st_mode) & 0o777)

    required = {'package.json', 'package-lock.json', 'hostinger/build.mjs',
                'hostinger/server.mjs', 'hostinger/prepare.mjs', 'hostinger/schema.sql',
                'hostinger/auth/schema.sql', 'hostinger/.env.example', 'hostinger/UPLOAD_README.md'}
    if not required.issubset(files):
        raise PackageError('Required Hostinger source or upload README is missing.')
    package = json.loads(files['package.json'][0])
    if not isinstance(package.get('scripts'), dict):
        raise PackageError('package.json must contain a scripts object.')
    package['scripts']['build'] = 'node hostinger/build.mjs'
    package['scripts']['start'] = 'node hostinger/server.mjs'
    files['package.json'] = ((json.dumps(package, indent=2, ensure_ascii=False) + '\n').encode(), 0o644)
    files['.npmrc'] = (b'include[]=dev\ninclude[]=optional\n', 0o644)
    files['START_HERE_HOSTINGER.md'] = (files['hostinger/UPLOAD_README.md'][0], 0o644)
    profile = {'profile': 'hostinger-node', 'source_commit': commit, 'source_dirty': dirty,
               'framework': 'Other', 'node': '24', 'build': 'npm run build',
               'output': '.hostinger-app', 'entry': 'hostinger/server.mjs', 'start': 'npm start'}
    files['hostinger-upload.json'] = ((json.dumps(profile, indent=2) + '\n').encode(), 0o644)

    target.parent.mkdir(parents=True, exist_ok=True)
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(prefix='.northwalleg-upload-', suffix='.partial',
                                         dir=target.parent, delete=False) as stream:
            temporary = Path(stream.name)
        with zipfile.ZipFile(temporary, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
            for name, (data, mode) in sorted(files.items()):
                entry = zipfile.ZipInfo(name, date_time=date_time)
                entry.create_system = 3
                entry.external_attr = (stat.S_IFREG | mode) << 16
                entry.compress_type = zipfile.ZIP_DEFLATED
                archive.writestr(entry, data)
        if temporary.stat().st_size > MAX_ARCHIVE_BYTES:
            raise PackageError('Compressed ZIP exceeds the 50 MB upload bound.')
        digest = hashlib.sha256(temporary.read_bytes()).hexdigest()
        os.replace(temporary, target)
        temporary = None
        checksum_path.write_text(digest + '  ' + target.name + '\n', encoding='utf-8')
        print(json.dumps({'archive': str(target), 'checksum_file': str(checksum_path),
                          'sha256': digest, 'size_bytes': target.stat().st_size,
                          'file_count': len(files), 'source_commit': commit,
                          'source_dirty': dirty, 'profile': profile['profile']}))
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)


if __name__ == '__main__':
    try:
        main()
    except (PackageError, OSError, ValueError, UnicodeDecodeError) as error:
        print(json.dumps({'error': str(error)}), file=sys.stderr)
        raise SystemExit(1)
