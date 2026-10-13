"""Local archive E2E: python .github/actions/install-linux-dependencies/validate.py

Requires PyYAML, tar/zstd and Node 22 on PATH; pipe stdout to the evidence directory. GitHub's cache
transport is replaced by local tar/zstd, not by a remote workflow or upload.
"""
import json
import os
import pathlib
import shutil
import subprocess
import tempfile
import time

import yaml

repo = pathlib.Path(__file__).resolve().parents[3]
temporary = tempfile.TemporaryDirectory(prefix='linux-cache-e2e-')
scratch = pathlib.Path(temporary.name)
project = scratch / 'packages/linux-dashboard'
project.mkdir(parents=True)
for name in ['package.json', 'package-lock.json', 'tsconfig.json']:
    shutil.copyfile(repo / 'packages/linux-dashboard' / name, project / name)
for name in ['src', 'test']:
    shutil.copytree(repo / 'packages/linux-dashboard' / name, project / name)
action_path = repo / '.github/actions/install-linux-dependencies'
action = yaml.safe_load((action_path / 'action.yml').read_text())
env = dict(os.environ, npm_config_cache=str(scratch / 'npm-store'))
caches = {}
metrics = {}


def command(args, cwd=project, expect=0):
    result = subprocess.run(args, cwd=cwd, env=env, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    print(result.stdout, end='')
    assert result.returncode == expect, (args, result.returncode, expect)


def evaluate(text, values):
    for name, value in values.items():
        text = text.replace('${{ ' + name + ' }}', value)
    return text


def run_action(fallback='false', fail_after=False):
    values = {'inputs.allow-install-fallback': fallback, 'github.action_path': str(action_path)}
    performed = []
    start = time.monotonic()
    for step in action['runs']['steps']:
        condition = step.get('if')
        if condition:
            for name in ['steps.restore.outputs.cache-hit', 'steps.verify.outputs.valid', 'steps.install.outputs.frozen']:
                condition = condition.replace(name, repr(values.get(name, '')))
            if not eval(condition.replace('||', 'or').replace('&&', 'and')):
                continue
        performed.append(step.get('id', step['name']))
        if 'uses' in step:
            key = evaluate(step['with']['key'], values)
            if '/restore@' in step['uses']:
                hit = key in caches
                values['steps.restore.outputs.cache-hit'] = str(hit).lower()
                if hit:
                    shutil.rmtree(project / 'node_modules', ignore_errors=True)
                    t = time.monotonic()
                    command(['tar', '-I', 'zstd', '-xf', str(caches[key])])
                    metrics['restore_seconds'] = time.monotonic() - t
            else:
                archive = scratch / (key + '.tar.zst')
                t = time.monotonic()
                command(['tar', '-I', 'zstd -T0 -3', '-cf', str(archive), 'node_modules'])
                metrics['archive_seconds'] = time.monotonic() - t
                metrics['archive_bytes'] = archive.stat().st_size
                caches[key] = archive
        else:
            output = scratch / 'action-output'
            output.write_text('')
            extra = {name: evaluate(value, values) for name, value in step.get('env', {}).items()}
            extra['GITHUB_OUTPUT'] = str(output)
            result = subprocess.run(['bash', '--noprofile', '--norc', '-eo', 'pipefail', '-c', step['run']], cwd=project,
                                    env=dict(env, **extra), text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
            print(result.stdout, end='')
            for line in output.read_text().splitlines():
                name, value = line.split('=', 1)
                values['steps.' + step['id'] + '.outputs.' + name] = value
            if result.returncode:
                return performed, False, time.monotonic() - start
    if fail_after:
        command(['bash', '-c', 'exit 1'], expect=1)
    return performed, True, time.monotonic() - start


print('Actual action scripts + local tar/zstd cache adapter; no GitHub workflow triggered.')
command(['node', '--version'])
command(['npm', '--version'])
command(['node', '--test', str(action_path / 'cache.test.cjs')])
performed, success, cold = run_action(fail_after=True)
assert success and 'Save completed npm tree' in performed and len(caches) == 1
assert not (project / 'node_modules/electron/dist').exists()
metrics['cold_action_seconds'] = cold
print('PASS cold install saved before simulated later build failure, without materializing Electron.')
shutil.rmtree(project / 'node_modules')
performed, success, warm = run_action()
assert success and 'install' not in performed and 'Save completed npm tree' not in performed
assert not (project / 'node_modules/electron/dist').exists()
metrics['warm_action_seconds'] = warm
measurements = dict(metrics)
print('PASS warm exact archive hit skips install, validates whole tree, preserves deferred Electron download.')
command(['npm', 'test'])
command(['node_modules/.bin/tsc', '--version'])
command(['node_modules/.bin/electron-builder', '--version'])
print('PASS restored real npm tests, TypeScript build, electron-builder CLI.')

# Delete archived source: an exact hit must reinstall, not accept it.
key, archive = next(iter(caches.items()))
shutil.rmtree(project / 'node_modules')
command(['tar', '-I', 'zstd', '-xf', str(archive)])
(project / 'node_modules/typescript/lib/typescript.js').unlink()
command(['tar', '-I', 'zstd -T0 -3', '-cf', str(archive), 'node_modules'])
performed, success, _ = run_action()
assert success and 'install' in performed and 'Save completed npm tree' not in performed
print('PASS incomplete exact archive reinstalls without overwriting immutable cache.')

# Real lock mismatch: default rejects, release falls back, neither saves.
manifest_path = project / 'package.json'
original = manifest_path.read_text()
manifest = json.loads(original)
manifest['devDependencies']['typescript'] = '5.8.3'
manifest_path.write_text(json.dumps(manifest))
performed, success, _ = run_action()
assert not success and 'Save completed npm tree' not in performed and len(caches) == 1
print('PASS failed npm ci exits without saving.')
performed, success, _ = run_action('true')
assert success and 'Save completed npm tree' not in performed and len(caches) == 1
assert json.loads((project / 'package-lock.json').read_text())['packages']['node_modules/typescript']['version'] == '5.8.3'
print('PASS real release fallback succeeds, mutates lock, never saves frozen tree.')
manifest['scripts']['postinstall'] = 'node -e "process.exit(7)"'
manifest_path.write_text(json.dumps(manifest))
performed, success, _ = run_action('true')
assert not success and 'Save completed npm tree' not in performed and len(caches) == 1
print('PASS lifecycle failure in both ci and release fallback exits without saving.')
manifest_path.write_text(original)
shutil.copyfile(repo / 'packages/linux-dashboard/package-lock.json', project / 'package-lock.json')
performed, success, _ = run_action()
assert success and 'install' in performed
print('PASS frozen caller reinstalls its original lock after fallback.')
print('MEASUREMENTS ' + json.dumps(measurements, sort_keys=True))
temporary.cleanup()
