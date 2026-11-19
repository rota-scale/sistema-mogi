# Social preview: mapa 3D de Itamogi

Gera `social-preview-3d-A2a.jpg` / `-A2b.jpg` (1280x640): ruas reais do OpenStreetMap (`itamogi-osm.json`, Overpass API, © OpenStreetMap contributors, ODbL), quadras extrudadas e relatos coloridos por prioridade 1 a 5.

Regerar: `pip install shapely cairosvg pillow && python3 build3d_a2.py` (fonte Urbanist; caminho via `URBANIST_TTF`). A versão publicada é a A2a, copiada para `../social-preview-1280x640.jpg`.
