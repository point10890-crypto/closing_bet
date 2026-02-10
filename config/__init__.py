# Config package
from .data_paths import DATA_PATHS, DataPaths

# Re-export root config.py symbols (market_gate.py etc. use "from config import ...")
import importlib.util as _ilu
import os as _os

_root_config = _os.path.join(_os.path.dirname(_os.path.dirname(_os.path.abspath(__file__))), 'config.py')
if _os.path.exists(_root_config):
    _spec = _ilu.spec_from_file_location("_root_config", _root_config)
    _mod = _ilu.module_from_spec(_spec)
    _spec.loader.exec_module(_mod)
    for _name in dir(_mod):
        if not _name.startswith('_'):
            globals()[_name] = getattr(_mod, _name)
