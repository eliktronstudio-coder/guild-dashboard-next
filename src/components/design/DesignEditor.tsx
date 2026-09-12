"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Monitor,
  Tablet,
  Smartphone,
  Undo2,
  Redo2,
  ExternalLink,
  Check,
  Loader2,
  AlertTriangle,
  Search,
  Lock,
  Unlock,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  History,
  MousePointer2,
  Hand,
  RotateCcw,
  Images,
  Layers,
  Type as TypeIcon,
  Boxes,
  LayoutTemplate as LayoutIcon,
  Eye,
  EyeOff,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import clsx from "clsx";
import PreviewFrame, { type PreviewMode } from "./PreviewFrame";
import PropertyPanel from "./PropertyPanel";
import MediaLibrary from "./MediaLibrary";
import BlocksPanel, { BlockSettings, type BlocksState, type Snippet } from "./BlocksPanel";
import LayoutPanel from "./LayoutPanel";
import { appendToSlot, findBlock, patchBlock as patchBlockOp } from "@/lib/design/blockOps";
import { instantiateSnippet, type SnippetPayload } from "@/lib/design/snippets";
import {
  PAGES,
  SHARED_ELEMENTS,
  SHARED_KEY,
  THEME_TOKENS,
  sectionsFor,
  textsFor,
  type ElementDef,
} from "@/lib/design/registry";
import { isValidValue } from "@/lib/design/properties";
import {
  BREAKPOINTS,
  SLOTS,
  STATES,
  THEME_MODES,
  walkBlocks,
  type Breakpoint,
  type DesignBlock,
  type LayoutEntry,
  type PageConfig,
  type SlotKey,
  type StateKey,
  type ThemeMode,
} from "@/lib/design/types";

type DesignState = {
  pageKey: string;
  draft: PageConfig;
  published: PageConfig;
  revision: number;
  hasUnpublished: boolean;
  draftUpdatedAt: string | null;
  publishedAt: string | null;
  publishedBy: string | null;
};

type SaveStatus = "idle" | "dirty" | "saving" | "saved" | "error";
type Version = { id: string; note: string; author: string; createdAt: string };
type LeftTab = "layout" | "elements" | "blocks" | "texts";

const DEVICE_WIDTH: Record<Breakpoint | "custom", number | null> = {
  base: null,
  tablet: 900,
  mobile: 390,
  custom: null,
};

const DEVICE_ICON = { base: Monitor, tablet: Tablet, mobile: Smartphone } as const;

function groupedPages() {
  const sections: { title: string; pages: typeof PAGES }[] = [];
  for (const page of PAGES) {
    let section = sections.find((s) => s.title === page.section);
    if (!section) {
      section = { title: page.section, pages: [] };
      sections.push(section);
    }
    section.pages.push(page);
  }
  return sections;
}

export default function DesignEditor({ initialUnpublished }: { initialUnpublished: Record<string, boolean> }) {
  const [pageKey, setPageKey] = useState<string>("home");
  const [state, setState] = useState<DesignState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; undo?: () => void } | null>(null);
  const [unpublished, setUnpublished] = useState(initialUnpublished);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [breakpoint, setBreakpoint] = useState<Breakpoint>("base");
  const [elementState, setElementState] = useState<StateKey>("normal");
  const [themeMode, setThemeMode] = useState<ThemeMode>("dark");
  const [device, setDevice] = useState<Breakpoint | "custom">("base");
  const [customWidth, setCustomWidth] = useState(1280);
  const [mode, setMode] = useState<PreviewMode>("select");
  const [search, setSearch] = useState("");
  const [leftTab, setLeftTab] = useState<LeftTab>("elements");
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [presentIds, setPresentIds] = useState<Set<string>>(new Set());
  const [previewSharedDraft, setPreviewSharedDraft] = useState(false);

  const [samples, setSamples] = useState<{ id: string; label: string }[]>([]);
  const [sampleId, setSampleId] = useState<string>("");

  const [historyOpen, setHistoryOpen] = useState(false);
  const [versions, setVersions] = useState<Version[]>([]);

  const [snippets, setSnippets] = useState<(Snippet & { payload: SnippetPayload })[]>([]);
  const [mediaOpen, setMediaOpen] = useState(false);
  /** Куда положить выбранный файл: свойство элемента или картинка блока. */
  const mediaTarget = useRef<{ kind: "prop"; prop: string } | { kind: "block"; blockId: string } | null>(null);

  const undoStack = useRef<PageConfig[]>([]);
  const redoStack = useRef<PageConfig[]>([]);
  const [stackSizes, setStackSizes] = useState({ undo: 0, redo: 0 });

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reloadPreview = useRef<() => void>(() => {});

  const page = PAGES.find((p) => p.key === pageKey);
  const isShared = pageKey === SHARED_KEY;

  const load = useCallback(async (key: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/design/${key}`, { cache: "no-store" });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Не удалось загрузить оформление.");
      const data = (await res.json()) as DesignState;
      setState(data);
      undoStack.current = [];
      redoStack.current = [];
      setStackSizes({ undo: 0, redo: 0 });
      setSaveStatus("idle");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(pageKey);
    setSelectedId(null);
    setLeftTab(pageKey === SHARED_KEY ? "elements" : "elements");
  }, [pageKey, load]);

  useEffect(() => {
    if (!page?.template) {
      setSamples([]);
      setSampleId("");
      return;
    }
    let alive = true;
    void (async () => {
      const res = await fetch(`/api/design/samples?kind=${page.template!.sampleKind}`, { cache: "no-store" });
      if (!res.ok || !alive) return;
      const data = (await res.json()) as { samples: { id: string; label: string }[] };
      if (!alive) return;
      setSamples(data.samples);
      setSampleId((prev) => prev || data.samples[0]?.id || "");
    })();
    return () => {
      alive = false;
    };
  }, [page]);

  const loadSnippets = useCallback(async () => {
    const res = await fetch("/api/design/snippets", { cache: "no-store" });
    if (!res.ok) return;
    const data = (await res.json()) as { items: (Snippet & { payload: SnippetPayload })[] };
    setSnippets(data.items.filter((i) => i.payload));
  }, []);

  useEffect(() => {
    void loadSnippets();
  }, [loadSnippets]);

  const persist = useCallback(async (config: PageConfig, key: string) => {
    setSaveStatus("saving");
    try {
      const res = await fetch(`/api/design/${key}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Не удалось сохранить черновик.");
      const data = (await res.json()) as DesignState;
      // Черновик оставляем локальный: сервер мог отбросить значение, которое
      // администратор ещё правит, и подмена поля «прыгала» бы под курсором.
      setState((prev) => (prev && prev.pageKey === key ? { ...data, draft: prev.draft } : data));
      setUnpublished((prev) => ({ ...prev, [key]: data.hasUnpublished }));
      setSaveStatus("saved");
    } catch (e) {
      setSaveStatus("error");
      setError(e instanceof Error ? e.message : "Ошибка сохранения.");
    }
  }, []);

  const mutate = useCallback(
    (next: PageConfig) => {
      setState((prev) => {
        if (!prev) return prev;
        undoStack.current.push(prev.draft);
        if (undoStack.current.length > 100) undoStack.current.shift();
        redoStack.current = [];
        setStackSizes({ undo: undoStack.current.length, redo: 0 });
        return { ...prev, draft: next, hasUnpublished: true };
      });
      setUnpublished((prev) => ({ ...prev, [pageKey]: true }));
      setSaveStatus("dirty");

      if (saveTimer.current) clearTimeout(saveTimer.current);
      const key = pageKey;
      saveTimer.current = setTimeout(() => void persist(next, key), 700);
    },
    [pageKey, persist]
  );

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [pageKey]);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (saveStatus === "dirty" || saveStatus === "saving") {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [saveStatus]);

  const lockedSet = useMemo(() => new Set(state?.draft.locks ?? []), [state]);

  /**
   * Записывает значение свойства любого элемента на текущем брейкпоинте и в
   * текущем состоянии. Пустая строка удаляет значение, и если у элемента не
   * осталось настроек, он убирается из конфига — чтобы в нём не копились
   * пустые ветки.
   */
  function setElementProperty(elementId: string, prop: string, raw: string) {
    if (!state || lockedSet.has(elementId)) return;
    const value = raw.trim();
    const next: PageConfig = { ...state.draft, elements: { ...state.draft.elements } };
    const values = { ...(next.elements[elementId] ?? {}) };
    const byBp = { ...(values[prop] ?? {}) };
    const byState = { ...(byBp[breakpoint] ?? {}) };

    if (value === "") delete byState[elementState];
    else byState[elementState] = value;

    if (Object.keys(byState).length === 0) delete byBp[breakpoint];
    else byBp[breakpoint] = byState;

    if (Object.keys(byBp).length === 0) delete values[prop];
    else values[prop] = byBp;

    if (Object.keys(values).length === 0) delete next.elements[elementId];
    else next.elements[elementId] = values;

    mutate(next);
  }

  function setProperty(prop: string, raw: string) {
    if (!selectedId) return;
    setElementProperty(selectedId, prop, raw);
  }

  /** Своё значение свойства элемента на текущем брейкпоинте/состоянии. */
  function readElementValue(elementId: string, prop: string): string {
    return state?.draft.elements[elementId]?.[prop]?.[breakpoint]?.[elementState] ?? "";
  }

  function resetElement() {
    if (!state || !selectedId) return;
    const next: PageConfig = { ...state.draft, elements: { ...state.draft.elements } };
    delete next.elements[selectedId];
    mutate(next);
  }

  function toggleLock() {
    if (!state || !selectedId) return;
    const locks = new Set(state.draft.locks ?? []);
    if (locks.has(selectedId)) locks.delete(selectedId);
    else locks.add(selectedId);
    mutate({ ...state.draft, locks: [...locks] });
  }

  function setToken(token: string, raw: string) {
    if (!state) return;
    const value = raw.trim();
    const tokens = { ...(state.draft.tokens ?? {}) };
    const byMode = { ...(tokens[themeMode] ?? {}) };
    if (value === "") delete byMode[token];
    else byMode[token] = value;
    tokens[themeMode] = byMode;
    mutate({ ...state.draft, tokens });
  }

  function setText(id: string, raw: string) {
    if (!state) return;
    const texts = { ...(state.draft.texts ?? {}) };
    const value = raw.trim();
    if (value === "") delete texts[id];
    else texts[id] = value;
    mutate({ ...state.draft, texts });
  }

  function setLayout(next: LayoutEntry[]) {
    if (!state) return;
    mutate({ ...state.draft, layout: next });
  }

  function setBlocks(next: BlocksState) {
    if (!state) return;
    mutate({ ...state.draft, blocks: next });
  }

  function patchBlock(blockId: string, changes: Partial<DesignBlock>) {
    if (!state) return;
    mutate({ ...state.draft, blocks: patchBlockOp(state.draft.blocks ?? {}, blockId, changes) });
  }

  /** Сохраняет блок вместе с его оформлением как переиспользуемую заготовку. */
  async function saveSnippet(blockId: string, name: string) {
    if (!state) return;
    const block = findBlock(state.draft.blocks ?? {}, blockId);
    if (!block) return;

    // Забираем оформление всего поддерева, иначе заготовка потеряет вид.
    const styles: Record<string, unknown> = {};
    walkBlocks([block], (b) => {
      const key = `block.${b.id}`;
      const values = state.draft.elements[key];
      if (values) styles[key] = values;
    });

    const res = await fetch("/api/design/snippets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, payload: { block, styles } }),
    });
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error ?? "Не удалось сохранить блок.");
      return;
    }
    await loadSnippets();
    setNotice({ text: `Блок «${name}» сохранён и доступен на всех страницах.` });
  }

  /** Вставляет заготовку: новые id у блоков и перенесённое на них оформление. */
  function insertSnippet(snippetId: string, slot: SlotKey, parentId: string | null) {
    if (!state) return;
    const snippet = snippets.find((s) => s.id === snippetId);
    if (!snippet) return;

    const { block, styles } = instantiateSnippet(snippet.payload);
    let blocks = state.draft.blocks ?? {};
    if (parentId) {
      const parent = findBlock(blocks, parentId);
      if (!parent) return;
      blocks = patchBlockOp(blocks, parentId, { children: [...(parent.children ?? []), block] });
    } else {
      blocks = appendToSlot(blocks, slot, block);
    }
    mutate({ ...state.draft, blocks, elements: { ...state.draft.elements, ...styles } });
    setSelectedId(`block.${block.id}`);
  }

  async function deleteSnippet(snippetId: string) {
    if (!window.confirm("Удалить заготовку? Блоки, уже вставленные на страницы, останутся на месте.")) return;
    const res = await fetch(`/api/design/snippets/${snippetId}`, { method: "DELETE" });
    if (!res.ok) {
      setError("Не удалось удалить заготовку.");
      return;
    }
    await loadSnippets();
  }
  function undo() {
    if (!state || undoStack.current.length === 0) return;
    const prev = undoStack.current.pop()!;
    redoStack.current.push(state.draft);
    setStackSizes({ undo: undoStack.current.length, redo: redoStack.current.length });
    setState({ ...state, draft: prev });
    scheduleSave(prev);
  }

  function redo() {
    if (!state || redoStack.current.length === 0) return;
    const next = redoStack.current.pop()!;
    undoStack.current.push(state.draft);
    setStackSizes({ undo: undoStack.current.length, redo: redoStack.current.length });
    setState({ ...state, draft: next });
    scheduleSave(next);
  }

  function scheduleSave(config: PageConfig) {
    setSaveStatus("dirty");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    const key = pageKey;
    saveTimer.current = setTimeout(() => void persist(config, key), 400);
  }

  async function flushThen(action: () => Promise<void>) {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
      if (state) await persist(state.draft, pageKey);
    }
    await action();
  }

  async function publish() {
    if (!state) return;
    await flushThen(async () => {
      setError(null);
      setSaveStatus("saving");
      const res = await fetch(`/api/design/${pageKey}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revision: state.revision, note: `Обновлено оформление: ${label(pageKey)}` }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSaveStatus("error");
        setError(data.error ?? "Не удалось применить изменения.");
        if (data.conflict) await load(pageKey);
        return;
      }
      setState(data as DesignState);
      setUnpublished((prev) => ({ ...prev, [pageKey]: false }));
      setSaveStatus("saved");
      setNotice({ text: "Изменения опубликованы." });
      reloadPreview.current();
    });
  }

  async function revert() {
    if (!state) return;
    const confirmed = window.confirm(
      "Черновик этой страницы вернётся к последней опубликованной версии. Несохранённые правки будут потеряны. Продолжить?"
    );
    if (!confirmed) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    const res = await fetch(`/api/design/${pageKey}/revert`, { method: "POST" });
    if (!res.ok) {
      setError("Не удалось отменить изменения.");
      return;
    }
    const data = (await res.json()) as DesignState;
    setState(data);
    setUnpublished((prev) => ({ ...prev, [pageKey]: false }));
    undoStack.current = [];
    redoStack.current = [];
    setStackSizes({ undo: 0, redo: 0 });
    setSaveStatus("idle");
    reloadPreview.current();
  }

  async function openHistory() {
    setHistoryOpen(true);
    const res = await fetch(`/api/design/${pageKey}/history`, { cache: "no-store" });
    if (res.ok) setVersions(((await res.json()) as { versions: Version[] }).versions);
  }

  async function restore(versionId: string) {
    const res = await fetch(`/api/design/${pageKey}/history`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ versionId }),
    });
    if (!res.ok) {
      setError("Не удалось восстановить версию.");
      return;
    }
    const data = (await res.json()) as DesignState;
    setState(data);
    setUnpublished((prev) => ({ ...prev, [pageKey]: data.hasUnpublished }));
    setHistoryOpen(false);
    setNotice({ text: "Версия положена в черновик. Нажмите «Применить», чтобы опубликовать." });
    reloadPreview.current();
  }

  function label(key: string) {
    return key === SHARED_KEY ? "Общие элементы и тема" : PAGES.find((p) => p.key === key)?.label ?? key;
  }

  function pickMedia(id: string) {
    const target = mediaTarget.current;
    setMediaOpen(false);
    mediaTarget.current = null;
    if (!target) return;
    if (target.kind === "prop") setProperty(target.prop, id);
    else patchBlock(target.blockId, { mediaId: id });
  }

  const previewSrc = useMemo(() => {
    const base =
      page?.template && sampleId
        ? page.template.buildRoute(sampleId)
        : isShared
          ? "/dashboard"
          : page?.route ?? "/";
    const params = new URLSearchParams({ __design_preview: pageKey });
    if (isShared || previewSharedDraft) params.set("__design_shared_draft", "1");
    return `${base}?${params.toString()}`;
  }, [page, sampleId, isShared, pageKey, previewSharedDraft]);

  /** Все блоки текущего черновика — для дерева и настроек. */
  const blockIndex = useMemo(() => {
    const map = new Map<string, { block: DesignBlock; slot: SlotKey }>();
    for (const slot of SLOTS) {
      walkBlocks(state?.draft.blocks?.[slot.key] ?? [], (block) => {
        map.set(`block.${block.id}`, { block, slot: slot.key });
      });
    }
    return map;
  }, [state]);

  const visibleElements = useMemo(() => {
    const q = search.trim().toLowerCase();
    const own: (ElementDef & { shared: boolean })[] = (isShared ? SHARED_ELEMENTS : page?.elements ?? []).map((e) => ({
      ...e,
      shared: isShared,
    }));
    const sharedForPage = isShared ? [] : SHARED_ELEMENTS.map((e) => ({ ...e, shared: true }));
    const all = [...own, ...sharedForPage];
    if (!q) return all;
    return all.filter((e) => e.label.toLowerCase().includes(q) || e.id.toLowerCase().includes(q));
  }, [page, search, isShared]);

  const selectedBlock = selectedId ? blockIndex.get(selectedId) : undefined;
  const selectedDef = visibleElements.find((e) => e.id === selectedId) ?? null;
  const selectedIsShared = Boolean(selectedDef?.shared) && !isShared;
  const selectedLocked = selectedId ? lockedSet.has(selectedId) || Boolean(selectedBlock?.block.locked) : false;

  const sections = useMemo(groupedPages, []);
  const texts = textsFor(pageKey);

  const statusText: Record<SaveStatus, string> = {
    idle: "Изменений нет",
    dirty: "Есть несохранённые правки…",
    saving: "Сохранение…",
    saved: "Черновик сохранён",
    error: "Ошибка сохранения",
  };

  const selectedLabel = selectedBlock
    ? selectedBlock.block.name || "Добавленный блок"
    : selectedDef?.label ?? "";

  return (
    <div className="flex h-[calc(100vh-8rem)] min-h-[620px] flex-col gap-3">
      {/* Подвкладки страниц */}
      <div className="rounded-lg border border-border bg-surface p-2">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setPageKey(SHARED_KEY)}
            className={clsx(
              "relative rounded-md border px-3 py-1.5 text-xs font-medium",
              isShared ? "border-accent bg-accent-soft text-accent" : "border-border text-muted hover:text-foreground"
            )}
          >
            Общие элементы и тема
            {unpublished[SHARED_KEY] && (
              <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-accent" title="Есть неопубликованные изменения" />
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              mediaTarget.current = null;
              setMediaOpen(true);
            }}
            className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs text-muted hover:text-foreground"
          >
            <Images size={13} /> Медиатека
          </button>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {sections.map((section) => (
            <div key={section.title} className="min-w-0">
              <p className="mb-1 text-[10px] uppercase tracking-wider text-muted-2">{section.title}</p>
              <div className="flex flex-wrap gap-1.5">
                {section.pages.map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => setPageKey(p.key)}
                    className={clsx(
                      "relative rounded-md border px-2.5 py-1.5 text-xs",
                      pageKey === p.key
                        ? "border-accent bg-accent-soft text-accent"
                        : "border-border text-muted hover:text-foreground"
                    )}
                  >
                    {p.label}
                    {unpublished[p.key] && (
                      <span
                        className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-accent"
                        title="Есть неопубликованные изменения"
                      />
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Панель действий */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">Редактируется: {label(pageKey)}</p>
          {isShared ? (
            <p className="text-[11px] text-accent">Изменения в этом разделе распространяются на весь сайт.</p>
          ) : page?.template ? (
            <p className="text-[11px] text-muted">{page.template.note}</p>
          ) : (
            <p className="text-[11px] text-muted">Изменения затрагивают только эту страницу.</p>
          )}
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <div className="flex items-center rounded-md border border-border">
            {(["base", "tablet", "mobile"] as const).map((d) => {
              const Icon = DEVICE_ICON[d];
              return (
                <button
                  key={d}
                  type="button"
                  title={BREAKPOINTS.find((b) => b.key === d)?.label}
                  onClick={() => {
                    setDevice(d);
                    setBreakpoint(d);
                  }}
                  className={clsx("px-2 py-1.5", device === d ? "bg-accent-soft text-accent" : "text-muted")}
                >
                  <Icon size={14} />
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setDevice("custom")}
              className={clsx("px-2 py-1.5 text-[11px]", device === "custom" ? "bg-accent-soft text-accent" : "text-muted")}
            >
              Своя
            </button>
          </div>
          {device === "custom" && (
            <input
              type="number"
              min={320}
              max={2560}
              value={customWidth}
              onChange={(e) => setCustomWidth(Number(e.target.value) || 1280)}
              className="w-20 rounded-md border border-border bg-surface-2 px-2 py-1.5 text-xs"
            />
          )}

          <div className="flex items-center rounded-md border border-border">
            <button
              type="button"
              title="Режим выбора элементов"
              onClick={() => setMode("select")}
              className={clsx("px-2 py-1.5", mode === "select" ? "bg-accent-soft text-accent" : "text-muted")}
            >
              <MousePointer2 size={14} />
            </button>
            <button
              type="button"
              title="Проверка взаимодействий"
              onClick={() => setMode("interact")}
              className={clsx("px-2 py-1.5", mode === "interact" ? "bg-accent-soft text-accent" : "text-muted")}
            >
              <Hand size={14} />
            </button>
          </div>

          <button type="button" onClick={undo} disabled={stackSizes.undo === 0} title="Отменить"
            className="rounded-md border border-border p-1.5 text-muted hover:text-foreground disabled:opacity-40">
            <Undo2 size={14} />
          </button>
          <button type="button" onClick={redo} disabled={stackSizes.redo === 0} title="Повторить"
            className="rounded-md border border-border p-1.5 text-muted hover:text-foreground disabled:opacity-40">
            <Redo2 size={14} />
          </button>

          <span className="flex items-center gap-1.5 rounded-md bg-surface-2 px-2 py-1.5 text-[11px] text-muted">
            {saveStatus === "saving" && <Loader2 size={12} className="animate-spin" />}
            {saveStatus === "saved" && <Check size={12} className="text-success" />}
            {saveStatus === "error" && <AlertTriangle size={12} className="text-danger" />}
            {statusText[saveStatus]}
          </span>

          <button type="button" onClick={openHistory}
            className="flex items-center gap-1 rounded-md border border-border px-2 py-1.5 text-[11px] text-muted hover:text-foreground">
            <History size={13} /> История
          </button>
          <button type="button" onClick={() => window.open(previewSrc, "_blank", "noopener")}
            className="flex items-center gap-1 rounded-md border border-border px-2 py-1.5 text-[11px] text-muted hover:text-foreground">
            <ExternalLink size={13} /> Предпросмотр
          </button>
          <button type="button" onClick={revert}
            className="rounded-md border border-border px-2 py-1.5 text-[11px] text-muted hover:text-danger">
            Отменить изменения
          </button>
          <button
            type="button"
            onClick={publish}
            disabled={!state?.hasUnpublished || saveStatus === "saving"}
            className="rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-black hover:bg-accent-bright disabled:opacity-50"
          >
            {isShared ? "Применить общие изменения" : "Применить изменения страницы"}
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">
          <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
          <span className="min-w-0 flex-1">{error}</span>
          <button type="button" onClick={() => setError(null)} className="flex-shrink-0 underline">
            Скрыть
          </button>
        </div>
      )}
      {notice && (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs text-muted">
          <span className="min-w-0 flex-1">{notice.text}</span>
          {notice.undo && (
            <button
              type="button"
              onClick={() => {
                notice.undo?.();
                setNotice(null);
              }}
              className="flex-shrink-0 text-accent underline"
            >
              Вернуть
            </button>
          )}
          <button type="button" onClick={() => setNotice(null)} className="flex-shrink-0 underline">
            Скрыть
          </button>
        </div>
      )}

      {/* Рабочая область */}
      <div className="flex min-h-0 flex-1 gap-3">
        {leftOpen ? (
          <div className="flex w-[272px] flex-shrink-0 flex-col rounded-lg border border-border bg-surface">
            <div className="flex items-center gap-0.5 border-b border-border p-1">
              {([
                { key: "layout" as LeftTab, label: "Структура", Icon: LayoutIcon },
                { key: "elements" as LeftTab, label: "Элементы", Icon: Layers },
                { key: "blocks" as LeftTab, label: "Блоки", Icon: Boxes },
                { key: "texts" as LeftTab, label: "Тексты", Icon: TypeIcon },
              ]).map(({ key, label: l, Icon }) => {
                const disabled = (key === "blocks" || key === "layout") && isShared;
                return (
                  <button
                    key={key}
                    type="button"
                    disabled={disabled}
                    title={disabled ? "Структура и блоки относятся к страницам, а не к общим элементам" : l}
                    onClick={() => setLeftTab(key)}
                    className={clsx(
                      "flex flex-1 items-center justify-center gap-1 rounded px-1.5 py-1.5 text-[11px]",
                      leftTab === key ? "bg-accent-soft text-accent" : "text-muted hover:text-foreground",
                      disabled && "opacity-40"
                    )}
                  >
                    <Icon size={12} /> {l}
                  </button>
                );
              })}
              <button type="button" onClick={() => setLeftOpen(false)} title="Свернуть панель"
                className="p-1 text-muted hover:text-foreground">
                <PanelLeftClose size={15} />
              </button>
            </div>

            {leftTab === "elements" && (
              <>
                <div className="border-b border-border p-2">
                  <div className="relative">
                    <Search size={13} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-muted" />
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Поиск элемента…"
                      className="w-full rounded-md border border-border bg-surface-2 py-1.5 pl-7 pr-2 text-xs outline-none focus:border-accent"
                    />
                  </div>
                </div>
                <div className="scroll-slim min-h-0 flex-1 overflow-y-auto p-1.5">
                  {visibleElements.length === 0 && (
                    <p className="px-2 py-3 text-[11px] text-muted-2">
                      У этой страницы нет собственных размеченных элементов. Ниже — общие элементы; их правка здесь
                      действует только на эту страницу.
                    </p>
                  )}
                  {visibleElements.map((el) => {
                    const isPresent = presentIds.size === 0 || presentIds.has(el.id);
                    const hasValues = Boolean(state?.draft.elements[el.id]);
                    const hidden = readElementValue(el.id, "display") === "none";
                    const order = readElementValue(el.id, "order");
                    return (
                      <div
                        key={el.id}
                        className={clsx(
                          "mb-0.5 flex w-full items-center gap-1 rounded px-2 py-1.5 text-xs",
                          selectedId === el.id ? "bg-accent-soft text-accent" : "text-foreground/80 hover:bg-surface-2",
                          el.parent && "pl-5"
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => setSelectedId(el.id)}
                          className="min-w-0 flex-1 truncate text-left"
                        >
                          {el.label}
                        </button>
                        {lockedSet.has(el.id) && <Lock size={10} className="flex-shrink-0 text-muted-2" />}
                        {el.shared && !isShared && (
                          <span className="flex-shrink-0 rounded bg-surface px-1 text-[9px] text-muted-2">общий</span>
                        )}
                        {hasValues && <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-accent" />}
                        {!isPresent && (
                          <span className="flex-shrink-0 text-[9px] text-muted-2" title="Не найден в предпросмотре">
                            нет
                          </span>
                        )}

                        {/* Быстрые действия: скрыть и переставить. Это визуальные
                            настройки — данные в базе не затрагиваются. */}
                        <button
                          type="button"
                          title={hidden ? "Показать элемент" : "Скрыть элемент (только визуально)"}
                          onClick={() => setElementProperty(el.id, "display", hidden ? "" : "none")}
                          className="flex-shrink-0 text-muted hover:text-foreground"
                        >
                          {hidden ? <EyeOff size={11} /> : <Eye size={11} />}
                        </button>
                        <button
                          type="button"
                          title="Поднять выше в своём контейнере"
                          onClick={() => setElementProperty(el.id, "order", String((Number(order) || 0) - 1))}
                          className="flex-shrink-0 text-muted hover:text-foreground"
                        >
                          <ArrowUp size={11} />
                        </button>
                        <button
                          type="button"
                          title="Опустить ниже в своём контейнере"
                          onClick={() => setElementProperty(el.id, "order", String((Number(order) || 0) + 1))}
                          className="flex-shrink-0 text-muted hover:text-foreground"
                        >
                          <ArrowDown size={11} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {leftTab === "layout" && !isShared && state && (
              <div className="scroll-slim min-h-0 flex-1 overflow-y-auto p-2">
                <LayoutPanel
                  layout={state.draft.layout ?? []}
                  sections={sectionsFor(pageKey)}
                  blocks={SLOTS.flatMap((slot) => state.draft.blocks?.[slot.key] ?? [])}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                  onChange={setLayout}
                />
              </div>
            )}

            {leftTab === "blocks" && !isShared && state && (
              <div className="scroll-slim min-h-0 flex-1 overflow-y-auto p-2">
                <p className="mb-2 text-[10px] text-muted-2">
                  Блоки добавляются над и под содержимым страницы. Удаление блока не затрагивает данные в базе.
                </p>
                <BlocksPanel
                  blocks={state.draft.blocks ?? {}}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                  onChange={setBlocks}
                  onDeleted={(restoreFn) => setNotice({ text: "Блок удалён.", undo: restoreFn })}
                  snippets={snippets}
                  onInsertSnippet={insertSnippet}
                  onSaveSnippet={(blockId, name) => void saveSnippet(blockId, name)}
                  onDeleteSnippet={(id) => void deleteSnippet(id)}
                />
              </div>
            )}

            {leftTab === "texts" && state && (
              <div className="scroll-slim min-h-0 flex-1 overflow-y-auto p-2">
                {texts.length === 0 ? (
                  <p className="px-1 py-2 text-[11px] text-muted-2">
                    У этой страницы нет подключённых статических подписей.
                  </p>
                ) : (
                  <>
                    <p className="mb-2 text-[10px] text-muted-2">
                      Это только статические подписи. Имена игроков, суммы и статистика берутся из базы и здесь не
                      меняются.
                    </p>
                    <div className="space-y-2.5">
                      {texts.map((t) => {
                        const value = state.draft.texts?.[t.id] ?? "";
                        return (
                          <label key={t.id} className="block text-[11px] text-muted">
                            {t.label}
                            <input
                              defaultValue={value}
                              key={`${pageKey}-${t.id}-${value}`}
                              placeholder={t.fallback}
                              onBlur={(e) => setText(t.id, e.target.value)}
                              className="mt-1 w-full rounded-md border border-border bg-surface-2 px-2 py-1.5 text-xs outline-none focus:border-accent"
                            />
                            {value === "" && (
                              <span className="mt-0.5 block text-[10px] text-muted-2">
                                В коде: «{t.fallback}»
                              </span>
                            )}
                          </label>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        ) : (
          <button type="button" onClick={() => setLeftOpen(true)} title="Показать панель"
            className="h-9 flex-shrink-0 rounded-lg border border-border bg-surface px-2 text-muted hover:text-foreground">
            <PanelLeftOpen size={15} />
          </button>
        )}

        {/* Предпросмотр */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-surface">
          <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-1.5 text-[11px] text-muted">
            <span className="truncate font-mono">{previewSrc}</span>
            {page?.template && samples.length > 0 && (
              <label className="ml-auto flex items-center gap-1.5">
                Пример:
                <select
                  value={sampleId}
                  onChange={(e) => setSampleId(e.target.value)}
                  className="max-w-[220px] rounded border border-border bg-surface-2 px-1.5 py-1 text-[11px]"
                >
                  {samples.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {!isShared && (
              <label className="ml-auto flex items-center gap-1.5" title="Показать в предпросмотре черновик общей темы">
                <input
                  type="checkbox"
                  checked={previewSharedDraft}
                  onChange={(e) => setPreviewSharedDraft(e.target.checked)}
                  className="h-3 w-3 accent-accent"
                />
                с черновиком общей темы
              </label>
            )}
          </div>
          {loading ? (
            <div className="flex flex-1 items-center justify-center text-xs text-muted">
              <Loader2 size={16} className="mr-2 animate-spin" /> Загрузка…
            </div>
          ) : (
            <PreviewFrame
              src={previewSrc}
              mode={mode}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onElementsFound={(ids) => setPresentIds(new Set(ids))}
              width={device === "custom" ? customWidth : DEVICE_WIDTH[device]}
              onReload={(fn) => {
                reloadPreview.current = fn;
              }}
            />
          )}
        </div>

        {/* Настройки */}
        {rightOpen ? (
          <div className="flex w-[304px] flex-shrink-0 flex-col rounded-lg border border-border bg-surface">
            <div className="flex items-center justify-between gap-1 border-b border-border px-2 py-1.5">
              <div className="flex items-center rounded-md border border-border">
                {BREAKPOINTS.map((b) => (
                  <button
                    key={b.key}
                    type="button"
                    onClick={() => setBreakpoint(b.key)}
                    className={clsx("px-1.5 py-1 text-[10px]", breakpoint === b.key ? "bg-accent-soft text-accent" : "text-muted")}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
              <select
                value={elementState}
                onChange={(e) => setElementState(e.target.value as StateKey)}
                className="rounded-md border border-border bg-surface-2 px-1 py-1 text-[10px]"
              >
                {STATES.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
              <button type="button" onClick={() => setRightOpen(false)} title="Свернуть" className="p-1 text-muted hover:text-foreground">
                <PanelRightClose size={15} />
              </button>
            </div>

            {isShared && state && (
              <details className="border-b border-border" open>
                <summary className="cursor-pointer px-3 py-2 text-xs font-medium">Палитра и токены темы</summary>
                <div className="space-y-2 px-3 pb-3">
                  <div className="flex items-center gap-1 rounded-md border border-border p-0.5">
                    {THEME_MODES.map((m) => (
                      <button
                        key={m.key}
                        type="button"
                        onClick={() => setThemeMode(m.key)}
                        className={clsx(
                          "flex-1 rounded px-2 py-1 text-[10px]",
                          themeMode === m.key ? "bg-accent-soft text-accent" : "text-muted hover:text-foreground"
                        )}
                      >
                        {m.label} тема
                      </button>
                    ))}
                  </div>
                  {THEME_TOKENS.map((t) => {
                    const value = state.draft.tokens?.[themeMode]?.[t.key] ?? "";
                    const invalid =
                      value !== "" &&
                      !isValidValue({ key: t.key, label: t.label, css: t.key, kind: "color", group: "colors" }, value);
                    return (
                      <div key={t.key} className="space-y-1">
                        <label className="flex items-center justify-between text-[11px] text-muted">
                          <span>{t.label}</span>
                          <span className="font-mono text-[9px] text-muted-2">--{t.key}</span>
                        </label>
                        <div className="flex items-center gap-1.5">
                          <input
                            defaultValue={value}
                            key={`${pageKey}-${themeMode}-${t.key}-${value}`}
                            placeholder="не задано"
                            onBlur={(e) => setToken(t.key, e.target.value)}
                            className={clsx(
                              "min-w-0 flex-1 rounded-md border bg-surface-2 px-2 py-1.5 text-xs outline-none",
                              invalid ? "border-danger" : "border-border focus:border-accent"
                            )}
                          />
                          <span
                            aria-hidden="true"
                            className="h-7 w-7 flex-shrink-0 rounded border border-border"
                            style={{ background: invalid || value === "" ? "transparent" : value }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </details>
            )}

            {selectedBlock && state && (
              <BlockSettings
                block={selectedBlock.block}
                slot={selectedBlock.slot}
                onPatch={(changes) => patchBlock(selectedBlock.block.id, changes)}
                onPickMedia={() => {
                  mediaTarget.current = { kind: "block", blockId: selectedBlock.block.id };
                  setMediaOpen(true);
                }}
              />
            )}

            {selectedId && state ? (
              <>
                {selectedIsShared && (
                  <div className="border-b border-border bg-surface-2 px-3 py-2 text-[11px] text-muted">
                    Это общий элемент сайта. Правка здесь создаёт переопределение только для «{label(pageKey)}».{" "}
                    <button type="button" onClick={() => setPageKey(SHARED_KEY)} className="text-accent underline">
                      Изменить для всего сайта
                    </button>
                  </div>
                )}
                <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-1.5">
                  <button type="button" onClick={toggleLock}
                    className="flex items-center gap-1 text-[11px] text-muted hover:text-foreground">
                    {lockedSet.has(selectedId) ? <Lock size={12} /> : <Unlock size={12} />}
                    {lockedSet.has(selectedId) ? "Разблокировать" : "Заблокировать"}
                  </button>
                  <button type="button" onClick={resetElement}
                    className="flex items-center gap-1 text-[11px] text-muted hover:text-danger">
                    <RotateCcw size={12} /> Сбросить элемент
                  </button>
                </div>
                <div className="min-h-0 flex-1">
                  <PropertyPanel
                    elementId={selectedId}
                    elementLabel={selectedLabel}
                    scopeLabel={
                      selectedBlock
                        ? `Область: блок на странице «${label(pageKey)}»`
                        : isShared
                          ? "Область: весь сайт"
                          : selectedIsShared
                            ? `Область: только страница «${label(pageKey)}»`
                            : `Область: страница «${label(pageKey)}»`
                    }
                    values={state.draft.elements[selectedId]}
                    breakpoint={breakpoint}
                    state={elementState}
                    onChange={setProperty}
                    onResetProp={(prop) => setProperty(prop, "")}
                    locked={selectedLocked}
                    onPickMedia={(prop) => {
                      mediaTarget.current = { kind: "prop", prop };
                      setMediaOpen(true);
                    }}
                  />
                </div>
              </>
            ) : (
              !isShared && (
                <p className="p-3 text-xs text-muted">
                  Выберите элемент — кликом в предпросмотре, в дереве слева или во вкладке «Блоки».
                </p>
              )
            )}
          </div>
        ) : (
          <button type="button" onClick={() => setRightOpen(true)} title="Показать настройки"
            className="h-9 flex-shrink-0 rounded-lg border border-border bg-surface px-2 text-muted hover:text-foreground">
            <PanelRightOpen size={15} />
          </button>
        )}
      </div>

      <MediaLibrary
        open={mediaOpen}
        onClose={() => {
          setMediaOpen(false);
          mediaTarget.current = null;
        }}
        onPick={mediaTarget.current ? pickMedia : undefined}
      />

      {historyOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setHistoryOpen(false)}>
          <div className="max-h-[80vh] w-full max-w-lg overflow-hidden rounded-lg border border-border bg-surface" onClick={(e) => e.stopPropagation()}>
            <div className="border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold">История публикаций — {label(pageKey)}</h2>
              <p className="mt-0.5 text-[11px] text-muted">
                Восстановление кладёт версию в черновик. Текущая опубликованная версия останется на месте, пока вы не
                нажмёте «Применить».
              </p>
            </div>
            <div className="scroll-slim max-h-[55vh] divide-y divide-border overflow-y-auto">
              {versions.length === 0 ? (
                <p className="px-4 py-6 text-center text-xs text-muted">Публикаций пока не было.</p>
              ) : (
                versions.map((v) => (
                  <div key={v.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-xs">{v.note || "Без описания"}</p>
                      <p className="text-[10px] text-muted-2">
                        {new Date(v.createdAt).toLocaleString("ru-RU")} · {v.author || "—"}
                      </p>
                    </div>
                    <button type="button" onClick={() => void restore(v.id)}
                      className="flex-shrink-0 rounded-md border border-border px-2 py-1 text-[11px] text-muted hover:text-foreground">
                      Восстановить
                    </button>
                  </div>
                ))
              )}
            </div>
            <div className="border-t border-border px-4 py-2 text-right">
              <button type="button" onClick={() => setHistoryOpen(false)} className="rounded-md border border-border px-3 py-1.5 text-xs">
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
