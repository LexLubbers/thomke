import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Rnd } from 'react-rnd';
import { toPng, toSvg } from 'html-to-image';
import {
  Upload,
  Download,
  Printer,
  Layers,
  Trash2,
  Copy,
  ChevronUp,
  ChevronDown,
  Undo2,
  Redo2,
  ImagePlus,
  Save,
  FolderOpen,
  Palette,
  Grid3X3,
} from 'lucide-react';

type Asset = {
  id: string;
  name: string;
  dataUrl: string;
};

type Piece = {
  id: string;
  assetId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  hue: number;
  saturate: number;
  brightness: number;
  contrast: number;
  opacity: number;
  z: number;
};

type Project = {
  assets: Asset[];
  pieces: Piece[];
};

const uid = () => Math.random().toString(36).slice(2, 10);
const PROJECT_KEY = 'modulaire-kunst-project-v1';

function SliderRow({
  label,
  min,
  max,
  step = 1,
  value,
  onChange,
  suffix = '',
}: {
  label: string;
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (v: number) => void;
  suffix?: string;
}) {
  return (
    <div className="mb-3">
      <div className="flex items-center justify-between text-sm mb-1">
        <span className="text-gray-700 flex items-center gap-2">
          <Palette className="w-4 h-4" /> {label}
        </span>
        <span className="tabular-nums text-gray-500">
          {value}
          {suffix}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-indigo-600"
      />
    </div>
  );
}

export default function ModulaireKunstStudio() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [pieces, setPieces] = useState<Piece[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [history, setHistory] = useState<Project[]>([]);
  const [future, setFuture] = useState<Project[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const piecesRef = useRef<HTMLDivElement | null>(null);
  const [suppressUI, setSuppressUI] = useState(false);
  const [snapEnabled, setSnapEnabled] = useState(false);
  const gridSize = 24;

  const selectedPiece = useMemo(
    () => pieces.find((p) => p.id === selectedId) || null,
    [pieces, selectedId]
  );

  const snapshot = () => ({ assets: structuredClone(assets), pieces: structuredClone(pieces) });
  const pushHistory = () => {
    setHistory((h) => [...h, snapshot()]);
    setFuture([]);
  };

  const undo = () => {
    if (!history.length) return;
    const prev = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    setFuture((f) => [snapshot(), ...f]);
    setAssets(prev.assets);
    setPieces(prev.pieces);
  };
  const redo = () => {
    if (!future.length) return;
    const next = future[0];
    setFuture((f) => f.slice(1));
    setHistory((h) => [...h, snapshot()]);
    setAssets(next.assets);
    setPieces(next.pieces);
  };

  const onUpload = async (files: FileList | null) => {
    if (!files || !files.length) return;
    pushHistory();
    const toDataUrl = (file: File) =>
      new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    const newAssets: Asset[] = [];
    for (const f of Array.from(files)) {
      const dataUrl = await toDataUrl(f);
      newAssets.push({ id: uid(), name: f.name, dataUrl });
    }
    setAssets((a) => [...a, ...newAssets]);
  };

  const addPieceFromAsset = (asset: Asset) => {
    if (!canvasRef.current) return;
    pushHistory();
    const rect = canvasRef.current.getBoundingClientRect();
    const defaultSize = Math.min(rect.width, rect.height) * 0.3;
    const newPiece: Piece = {
      id: uid(),
      assetId: asset.id,
      x: rect.width / 2 - defaultSize / 2,
      y: rect.height / 2 - defaultSize / 2,
      width: defaultSize,
      height: defaultSize,
      hue: 0,
      saturate: 100,
      brightness: 100,
      contrast: 100,
      opacity: 100,
      z: (pieces[pieces.length - 1]?.z ?? 0) + 1,
    };
    setPieces((p) => [...p, newPiece]);
    setSelectedId(newPiece.id);
  };

  const removeSelected = () => {
    if (!selectedId) return;
    pushHistory();
    setPieces((p) => p.filter((x) => x.id !== selectedId));
    setSelectedId(null);
  };

  const duplicateSelected = () => {
    if (!selectedPiece) return;
    pushHistory();
    const copy: Piece = {
      ...selectedPiece,
      id: uid(),
      x: selectedPiece.x + 20,
      y: selectedPiece.y + 20,
      z: selectedPiece.z + 1,
    };
    setPieces((p) => [...p, copy]);
    setSelectedId(copy.id);
  };

  const bringForward = () => {
    if (!selectedPiece) return;
    pushHistory();
    setPieces((p) => p.map((x) => (x.id === selectedPiece.id ? { ...x, z: x.z + 1 } : x)));
  };
  const sendBackward = () => {
    if (!selectedPiece) return;
    pushHistory();
    setPieces((p) => p.map((x) => (x.id === selectedPiece.id ? { ...x, z: Math.max(0, x.z - 1) } : x)));
  };

  const updateSelected = (patch: Partial<Piece>) => {
    if (!selectedPiece) return;
    setPieces((p) => p.map((x) => (x.id === selectedPiece.id ? { ...x, ...patch } : x)));
  };

  const filterCss = (pc: Piece) =>
    `hue-rotate(${pc.hue}deg) saturate(${pc.saturate}%) brightness(${pc.brightness}%) contrast(${pc.contrast}%)`;

  const saveProject = () => {
    const data: Project = { assets, pieces };
    localStorage.setItem(PROJECT_KEY, JSON.stringify(data));
    alert('Project opgeslagen in je browser.');
  };
  const loadProject = () => {
    const raw = localStorage.getItem(PROJECT_KEY);
    if (!raw) return alert('Geen opgeslagen project gevonden.');
    try {
      const data = JSON.parse(raw) as Project;
      setAssets(data.assets || []);
      setPieces(data.pieces || []);
      setSelectedId(null);
    } catch (e) {
      alert('Kon project niet laden.');
    }
  };

  const exportPNG = async () => {
    if (!piecesRef.current) return;
    setSuppressUI(true);
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    const dataUrl = await toPng(piecesRef.current, { cacheBust: true, pixelRatio: 2, backgroundColor: 'transparent' });
    setSuppressUI(false);
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `modulaire_kunst_${Date.now()}.png`;
    a.click();
  };

  const exportSVG = async () => {
    if (!piecesRef.current) return;
    setSuppressUI(true);
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    const dataUrl = await toSvg(piecesRef.current, { cacheBust: true, backgroundColor: 'transparent' });
    setSuppressUI(false);
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `modulaire_kunst_${Date.now()}.svg`;
    a.click();
  };

  const printCanvas = async () => {
    if (!piecesRef.current) return;
    setSuppressUI(true);
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    const dataUrl = await toPng(piecesRef.current, { cacheBust: true, pixelRatio: 2, backgroundColor: 'transparent' });
    setSuppressUI(false);
    const w = window.open('')!;
    w.document.write(`<img src="${dataUrl}" style="max-width:100%"/>`);
    w.document.close();
    w.focus();
    w.onload = () => w.print();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        removeSelected();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        duplicateSelected();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedPiece, history, future]);

  useEffect(() => {
    const defaults = [
      'art1.svg',
      'art2.svg',
      'art3.svg',
      'art4.svg',
      'art5.svg',
    ];
    Promise.all(
      defaults.map(async (name) => {
        const url = new URL(`./assets/${name}`, import.meta.url).href;
        const res = await fetch(url);
        const blob = await res.blob();
        return new Promise<Asset>((resolve) => {
          const r = new FileReader();
          r.onload = () => resolve({ id: uid(), name, dataUrl: String(r.result) });
          r.readAsDataURL(blob);
        });
      })
    ).then((arr) => setAssets(arr));
  }, []);

  return (
    <div className="h-screen w-full flex bg-gray-50 text-gray-900">
      <aside className="w-72 border-r border-gray-200 bg-white flex flex-col">
        <div className="p-4 border-b flex items-center gap-2">
          <ImagePlus className="w-5 h-5" />
          <h2 className="font-semibold">Jouw kunst</h2>
        </div>
        <div className="p-4 flex items-center gap-2">
          <button
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-indigo-600 text-white shadow hover:bg-indigo-700"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="w-4 h-4" /> Upload
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*"
            className="hidden"
            onChange={(e) => onUpload(e.target.files)}
          />
        </div>
        <div className="p-4 grid grid-cols-2 gap-3 overflow-auto">
          {assets.length === 0 && (
            <div className="col-span-2 text-sm text-gray-500">
              Upload één of meer afbeeldingen. Klik daarna op een thumbnail om
              die als blokje op het canvas te plaatsen.
            </div>
          )}
          {assets.map((a) => (
            <button
              key={a.id}
              onClick={() => addPieceFromAsset(a)}
              className="group relative aspect-square rounded-xl overflow-hidden border bg-gray-100 hover:ring-2 hover:ring-indigo-400"
              title="Voeg toe aan canvas"
            >
              <img src={a.dataUrl} alt={a.name} className="w-full h-full object-cover" />
              <span className="absolute bottom-0 left-0 right-0 text-[10px] bg-black/50 text-white px-1 py-0.5 truncate">
                {a.name}
              </span>
            </button>
          ))}
        </div>
      </aside>

      <main className="flex-1 flex flex-col">
        <div className="h-14 border-b bg-white flex items-center gap-2 px-4 flex-nowrap">
          <button className="inline-flex h-10 items-center whitespace-nowrap px-3 rounded-lg bg-gray-100 hover:bg-gray-200 gap-2" onClick={saveProject}>
            <Save className="w-4 h-4" /> Opslaan (project)
          </button>
          <button className="inline-flex h-10 items-center whitespace-nowrap px-3 rounded-lg bg-gray-100 hover:bg-gray-200 gap-2" onClick={loadProject}>
            <FolderOpen className="w-4 h-4" /> Laden
          </button>
          <div className="mx-2 w-px bg-gray-200 h-6" />
          <button className="inline-flex h-10 items-center whitespace-nowrap px-3 rounded-lg bg-gray-100 hover:bg-gray-200 gap-2" onClick={exportPNG}>
            <Download className="w-4 h-4" /> Exporteer PNG
          </button>
          <button className="inline-flex h-10 items-center whitespace-nowrap px-3 rounded-lg bg-gray-100 hover:bg-gray-200 gap-2" onClick={exportSVG}>
            <Download className="w-4 h-4" /> Exporteer SVG
          </button>
          <button className="inline-flex h-10 items-center whitespace-nowrap px-3 rounded-lg bg-gray-100 hover:bg-gray-200 gap-2" onClick={printCanvas}>
            <Printer className="w-4 h-4" /> Print
          </button>
          <button
            className={`inline-flex h-10 items-center whitespace-nowrap px-3 rounded-lg gap-2 border ${snapEnabled ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-gray-100 hover:bg-gray-200 border-transparent'}`}
            onClick={() => setSnapEnabled((v) => !v)}
            title="Toggle snap to grid"
          >
            <Grid3X3 className="w-4 h-4" /> Snap
          </button>
          <div className="mx-2 w-px bg-gray-200 h-6" />
          <div className="flex items-center gap-1">
          <button className="inline-flex h-10 w-10 items-center justify-center rounded-lg hover:bg-gray-100" onClick={undo} title="Ongedaan maken (Ctrl/Cmd+Z)">
            <Undo2 className="w-4 h-4" />
          </button>
          <button className="inline-flex h-10 w-10 items-center justify-center rounded-lg hover:bg-gray-100" onClick={redo} title="Opnieuw (Ctrl/Cmd+Y)">
            <Redo2 className="w-4 h-4" />
          </button>
          </div>
          <div className="ml-auto hidden md:block whitespace-nowrap text-sm text-gray-500">Tip: Delete = verwijderen · Ctrl/Cmd+D = dupliceren</div>
        </div>

        <div
          className="flex-1 relative overflow-hidden"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setSelectedId(null);
          }}
        >
          <div
            ref={canvasRef}
            className="absolute inset-4 rounded-2xl shadow bg-white/90 border border-gray-200"
            style={{
              backgroundImage:
                'linear-gradient(0deg, rgba(0,0,0,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.03) 1px, transparent 1px)',
              backgroundSize: '24px 24px',
            }}
          >
            <div ref={piecesRef} className="absolute inset-0">
            {pieces
              .slice()
              .sort((a, b) => a.z - b.z)
              .map((pc) => {
                const asset = assets.find((a) => a.id === pc.assetId);
                if (!asset) return null;
                return (
                  <Rnd
                    key={pc.id}
                    bounds="parent"
                    size={{ width: pc.width, height: pc.height }}
                    position={{ x: pc.x, y: pc.y }}
                    dragGrid={snapEnabled ? [gridSize, gridSize] : undefined}
                    resizeGrid={snapEnabled ? [gridSize, gridSize] : undefined}
                    onMouseDown={() => setSelectedId(pc.id)}
                    onDragStart={() => setSelectedId(pc.id)}
                    onResizeStart={() => setSelectedId(pc.id)}
                    onDragStop={(e, d) => {
                      const nx = snapEnabled ? Math.round(d.x / gridSize) * gridSize : d.x;
                      const ny = snapEnabled ? Math.round(d.y / gridSize) * gridSize : d.y;
                      updateSelected({ x: nx, y: ny });
                    }}
                    onResizeStop={(e, dir, ref, delta, pos) =>
                      setPieces((arr) =>
                        arr.map((x) =>
                          x.id === pc.id
                            ? {
                                ...x,
                                width: snapEnabled
                                  ? Math.round(parseFloat(ref.style.width) / gridSize) * gridSize
                                  : parseFloat(ref.style.width),
                                height: snapEnabled
                                  ? Math.round(parseFloat(ref.style.height) / gridSize) * gridSize
                                  : parseFloat(ref.style.height),
                                x: snapEnabled ? Math.round(pos.x / gridSize) * gridSize : pos.x,
                                y: snapEnabled ? Math.round(pos.y / gridSize) * gridSize : pos.y,
                              }
                            : x
                        )
                      )
                    }
                    style={{ zIndex: pc.z }}
                    className={
                      'group ' + (!suppressUI && pc.id === selectedId ? 'outline outline-2 outline-indigo-400/80' : '')
                    }
                    enableUserSelectHack={false}
                  >
                    <img
                      draggable={false}
                      alt={asset.name}
                      src={asset.dataUrl}
                      className="w-full h-full object-contain select-none"
                      style={{ filter: filterCss(pc), opacity: pc.opacity / 100 }}
                    />
                    {!suppressUI && (
                      <div className="absolute right-1 bottom-1 text-[10px] px-1 py-0.5 bg-black/40 text-white rounded opacity-0 group-hover:opacity-100">
                        versleep/resize
                      </div>
                    )}
                  </Rnd>
                );
              })}
            </div>
          </div>
        </div>
      </main>

      <aside className="w-80 border-l border-gray-200 bg-white">
        <div className="p-4 border-b flex items-center gap-2">
          <Layers className="w-5 h-5" />
          <h2 className="font-semibold">Eigenschappen</h2>
        </div>
        {!selectedPiece ? (
          <div className="p-6 text-sm text-gray-500">
            Selecteer een blokje op het canvas om kleur/laaggorde/opacity aan te passen.
          </div>
        ) : (
          <div className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <button className="px-2 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 inline-flex items-center gap-1" onClick={bringForward} title="Naar voren">
                <ChevronUp className="w-4 h-4" />Voor
              </button>
              <button className="px-2 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 inline-flex items-center gap-1" onClick={sendBackward} title="Naar achter">
                <ChevronDown className="w-4 h-4" />Achter
              </button>
              <button className="ml-auto px-2 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 inline-flex items-center gap-1" onClick={duplicateSelected} title="Dupliceren (Ctrl/Cmd+D)">
                <Copy className="w-4 h-4" />Dupliceer
              </button>
              <button className="px-2 py-1 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 inline-flex items-center gap-1" onClick={removeSelected} title="Verwijderen (Delete)">
                <Trash2 className="w-4 h-4" />Verwijder
              </button>
            </div>
            <div className="h-px bg-gray-200 my-1" />
            <SliderRow label="Hue" min={0} max={360} value={selectedPiece.hue} onChange={(v) => updateSelected({ hue: v })} suffix="°" />
            <SliderRow label="Saturatie" min={0} max={200} value={selectedPiece.saturate} onChange={(v) => updateSelected({ saturate: v })} suffix="%" />
            <SliderRow label="Helderheid" min={0} max={200} value={selectedPiece.brightness} onChange={(v) => updateSelected({ brightness: v })} suffix="%" />
            <SliderRow label="Contrast" min={0} max={200} value={selectedPiece.contrast} onChange={(v) => updateSelected({ contrast: v })} suffix="%" />
            <SliderRow label="Opacity" min={10} max={100} value={selectedPiece.opacity} onChange={(v) => updateSelected({ opacity: v })} suffix="%" />
            <div className="text-xs text-gray-500">Tip: Gebruik PNG export om de compositie als afbeelding te bewaren of te printen.</div>
          </div>
        )}
      </aside>
    </div>
  );
}


