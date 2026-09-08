"""Capture real Android screens and fail on missing UI or runtime crashes."""
import json
import pathlib
import re
import subprocess
import sys
import time
import xml.etree.ElementTree as ET

from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / 'artifacts'
OUT.mkdir(exist_ok=True)
PACKAGE = 'com.anonymous.sokchadapp'
REPORT = {'device': 'Android 11 / API 30 emulator', 'screens': [], 'restarts': []}


def adb(*args, check=True, timeout=45, binary=False):
    result = subprocess.run(['adb', *map(str, args)], capture_output=True,
                            text=not binary, timeout=timeout)
    if check and result.returncode:
        raise RuntimeError(f'adb {args[0]} failed: {result.stderr}')
    return result.stdout


def hierarchy():
    adb('shell', 'uiautomator', 'dump', '--compressed', '/sdcard/review-window.xml')
    xml = adb('exec-out', 'cat', '/sdcard/review-window.xml')
    return xml, ET.fromstring(xml)


def text_of(node):
    return node.get('text', '') + ' ' + node.get('content-desc', '')


def wait_for(texts, timeout=60):
    deadline = time.monotonic() + timeout
    last_error = None
    while time.monotonic() < deadline:
        try:
            xml, tree = hierarchy()
            for node in tree.iter('node'):
                if any(text in text_of(node) for text in texts):
                    return xml, tree, node
        except (ET.ParseError, RuntimeError, subprocess.TimeoutExpired) as error:
            last_error = str(error)
        time.sleep(2)
    raise AssertionError(f'Expected visible UI {texts}; last error: {last_error}')


def bounds(node):
    return tuple(map(int, re.findall(r'\d+', node.get('bounds', ''))))


def tap_text(texts):
    _, _, node = wait_for(texts)
    x1, y1, x2, y2 = bounds(node)
    adb('shell', 'input', 'tap', (x1 + x2) // 2, (y1 + y2) // 2)
    time.sleep(1)


def open_route(route=''):
    adb('shell', 'am', 'start', '-W', '-a', 'android.intent.action.VIEW',
        '-d', 'sokchadapp:///' + route, '-n', PACKAGE + '/.MainActivity')


def set_language(language):
    open_route('settings')
    tap_text(['Langue', 'Language', 'اللغة'])
    tap_text([{'fr': 'Français', 'ar': 'العربية', 'en': 'English'}[language]])
    wait_for([{'fr': 'Paramètres', 'ar': 'الإعدادات', 'en': 'Settings'}[language]])
    open_route()
    wait_home(language)


def wait_home(language):
    return wait_for([{'fr': 'Rechercher', 'ar': 'بحث', 'en': 'Search'}[language]])


def capture(name, language, check_seam=False):
    xml, tree, _ = wait_home(language)
    assert any(n.get('package') == PACKAGE for n in tree.iter('node')), 'Wrong foreground app'
    assert not any(n.get('package') == 'com.android.permissioncontroller'
                   for n in tree.iter('node')), 'Permission dialog still open'
    # Give remote product photos time to finish decoding before the raw capture.
    time.sleep(8)
    xml, tree = hierarchy()
    (OUT / f'{name}.xml').write_text(xml, encoding='utf-8')
    png = OUT / f'{name}.png'
    png.write_bytes(adb('exec-out', 'screencap', '-p', binary=True))
    image = Image.open(png).convert('RGB')
    entry = {'name': name, 'language': language, 'pixels': image.size,
             'bytes': png.stat().st_size, 'source': 'adb exec-out screencap -p'}
    if check_seam:
        buttons = [n for n in tree.iter('node') if
                   n.get('resource-id', '').endswith('home-filter-button')]
        assert buttons, 'Filter button not present in the real UI hierarchy'
        x1, y1, x2, y2 = bounds(buttons[0])
        y = y1 + (y2 - y1) // 4
        edge = x2 if language == 'ar' else x1 - 1
        inside = edge + 12 if language == 'ar' else edge - 12
        delta = max(abs(a - b) for a, b in zip(image.getpixel((edge, y)),
                                             image.getpixel((inside, y))))
        entry['search_seam_color_delta'] = delta
        assert delta <= 3, f'Visible search/filter seam: color delta {delta}'
        if 'restart' in name:
            banners = [n for n in tree.iter('node') if
                       n.get('resource-id', '').endswith('home-deals-banner')]
            assert banners, 'Deals banner missing from the initial home screen'
            bx1, by1, bx2, by2 = bounds(banners[0])
            entry['banner_bounds'] = [bx1, by1, bx2, by2]
            assert abs(bx1 - (image.width - bx2)) <= 2, 'Deals banner is not centered'
            assert abs((bx2 - bx1) / image.width - 0.9488) <= 0.005, 'Deals banner lost its reference width'
            assert abs((by2 - by1) / (bx2 - bx1) - 0.3) <= 0.005, 'Deals banner aspect ratio changed'
    REPORT['screens'].append(entry)
    save_report()
    print('Captured', name, image.size, flush=True)


def save_report():
    (OUT / 'android-review.json').write_text(
        json.dumps(REPORT, ensure_ascii=False, indent=2), encoding='utf-8')


def fresh_install(apk):
    installed = adb('shell', 'pm', 'path', PACKAGE, check=False).strip()
    if installed:
        adb('uninstall', PACKAGE)
    adb('install', '-g', apk, timeout=120)
    adb('shell', 'input', 'keyevent', 'KEYCODE_WAKEUP')
    adb('shell', 'input', 'keyevent', '82')
    open_route()
    wait_home('fr')


def resize(width, height, density):
    adb('shell', 'wm', 'size', f'{width}x{height}')
    adb('shell', 'wm', 'density', density)
    time.sleep(3)


try:
    resize(720, 1588, 294)
    adb('shell', 'settings', 'put', 'system', 'screen_off_timeout', '1800000')
    adb('shell', 'settings', 'put', 'global', 'window_animation_scale', '0')
    adb('shell', 'settings', 'put', 'global', 'transition_animation_scale', '0')
    baseline = OUT / 'baseline.apk'
    if baseline.exists():
        fresh_install(baseline)
        capture('before-fr', 'fr')
        set_language('ar')
        capture('before-ar', 'ar')

    fresh_install(OUT / 'SOKCHAD-responsive.apk')
    for cycle, language in enumerate(['fr', 'ar', 'fr'], 1):
        set_language(language)
        adb('shell', 'am', 'force-stop', PACKAGE)
        adb('logcat', '-c')
        open_route()
        wait_home(language)
        capture(f'after-{language}-restart-{cycle}', language, check_seam=True)
        log = adb('logcat', '-d')
        (OUT / f'restart-{cycle}.log').write_text(log, encoding='utf-8')
        fatal_count = log.count('FATAL')
        REPORT['restarts'].append({'cycle': cycle, 'language': language,
                                  'fatal_count': fatal_count,
                                  'language_persisted': True})
        save_report()
        assert fatal_count == 0, f'FATAL log entries after restart {cycle}: {fatal_count}'

    # Change the available window while the app remains open.
    for name, width, height, density in [('small', 640, 960, 320),
                                       ('wide', 720, 1024, 160)]:
        resize(width, height, density)
        for language in ['fr', 'ar']:
            set_language(language)
            capture(f'{name}-{language}', language, check_seam=True)
            adb('shell', 'input', 'swipe', width // 2, height * 3 // 4,
                width // 2, height // 3, '400')
            capture(f'{name}-{language}-products', language, check_seam=True)
    resize(720, 1588, 294)
    set_language('fr')
    adb('shell', 'settings', 'put', 'system', 'font_scale', '1.6')
    capture('large-font-fr', 'fr', check_seam=True)
    set_language('ar')
    capture('large-font-ar', 'ar', check_seam=True)
    adb('shell', 'settings', 'put', 'system', 'font_scale', '1.0')
    set_language('en')
    capture('after-en', 'en', check_seam=True)
    REPORT['status'] = 'passed'
except Exception as error:
    REPORT['status'] = 'failed'
    REPORT['error'] = str(error)
    try:
        (OUT / 'failure.png').write_bytes(adb('exec-out', 'screencap', '-p', binary=True))
        (OUT / 'failure-logcat.txt').write_text(adb('logcat', '-d'), encoding='utf-8')
        xml, _ = hierarchy()
        (OUT / 'failure.xml').write_text(xml, encoding='utf-8')
    except Exception:
        pass
    raise
finally:
    save_report()
