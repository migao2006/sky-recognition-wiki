"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { AccountStep } from "./account-step";
import {
  createAccountIdentityId,
  emptyBindings,
  type AccountInfo,
  type BindingKey,
  type BindingStatus,
} from "./account-config";
import {
  useCatalogStepState,
  useExportStepState,
} from "./organizer-step-state";
import { useAccountDraft } from "./use-account-draft";
import { useOwnedItems } from "./use-owned-items";
import { useOrganizerRuntime } from "./use-organizer-runtime";
import { shouldIdlePreload, type ConnectionHint } from "./idle-preload";

const CatalogStep = dynamic(
  () => import("./catalog-step").then((module) => module.CatalogStep),
  { ssr: false },
);
const ExportStep = dynamic(
  () => import("./export-step").then((module) => module.ExportStep),
  { ssr: false },
);

const emptyAccount = (): AccountInfo => ({
  name: "",
  accountType: "有翼",
  bindingsConfirmed: false,
  wardrobeConfirmed: false,
  identityId: createAccountIdentityId(),
  candles: "",
  hearts: "",
  ascended: "",
  passes: "",
  bindingNote: "",
  notes: "",
});

export default function AccountOrganizer() {
  const [activeStep, setActiveStep] = useState<1 | 2 | 3>(1);
  const [account, setAccount] = useState<AccountInfo>(emptyAccount);
  const [bindings, setBindings] =
    useState<Record<BindingKey, BindingStatus>>(emptyBindings);
  const [notice, setNotice] = useState("");
  const catalogStepState = useCatalogStepState();
  const exportStepState = useExportStepState();
  const announcedStep = useRef<1 | 2 | 3>(1);
  const [stepAnnouncement, setStepAnnouncement] = useState("");
  const invalidateWardrobeConfirmation = useCallback(() => {
    setAccount((previous) =>
      previous.wardrobeConfirmed
        ? { ...previous, wardrobeConfirmed: false }
        : previous,
    );
  }, []);
  const runtime = useOrganizerRuntime();
  const { owned, setOwned, updateOwned, toggleOwned } = useOwnedItems(
    invalidateWardrobeConfirmation,
    runtime.catalogDomain?.validItemGuids,
  );
  const { loadCatalog } = runtime;
  const { draftAvailable, draftReady, clearStoredDraft } = useAccountDraft({
    account,
    bindings,
    owned,
    setAccount,
    setBindings,
    setOwned,
    setNotice,
  });

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 2600);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const safelyLoadCatalog = useCallback(() => {
    void loadCatalog().catch(() => undefined);
  }, [loadCatalog]);
  useEffect(() => {
    if (!draftReady || runtime.catalogDomain) return;
    const connection = (
      navigator as Navigator & {
        connection?: ConnectionHint;
      }
    ).connection;
    if (!shouldIdlePreload(connection)) return;
    const timer = window.setTimeout(safelyLoadCatalog, 1_200);
    return () => window.clearTimeout(timer);
  }, [
    draftReady,
    runtime.catalogDomain,
    safelyLoadCatalog,
  ]);

  const goToStep = (step: 1 | 2 | 3) => {
    if (step === activeStep) return;
    if (step !== 1) safelyLoadCatalog();
    setActiveStep(step);
    const behavior = window.matchMedia("(prefers-reduced-motion: reduce)")
      .matches
      ? "auto"
      : "smooth";
    window.scrollTo({ top: 0, behavior });
  };

  const clearAllData = () => {
    if (!window.confirm("確定要清除帳號資料、綁定狀態與已選物品？")) return;
    clearStoredDraft();
    setAccount(emptyAccount());
    setBindings(emptyBindings());
    setOwned(new Set());
    setNotice("已清除全部資料");
  };

  const runtimeMissing = activeStep !== 1 && !runtime.catalogDomain;
  const runtimeFailed = runtime.catalogLoadError;
  const activeStepReady =
    activeStep === 1 ||
    Boolean(runtime.catalogDomain);

  useEffect(() => {
    if (!activeStepReady || announcedStep.current === activeStep) return;
    const stepName = ["", "帳號資料", "選擇物品", "整理與匯出"][activeStep];
    const focusFrame = window.requestAnimationFrame(() => {
      const heading = document.querySelector<HTMLElement>(".app-shell h1");
      if (!heading) return;
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
      setStepAnnouncement(`已切換至${stepName}`);
      announcedStep.current = activeStep;
    });
    return () => window.cancelAnimationFrame(focusFrame);
  }, [activeStep, activeStepReady]);

  return (
    <main
      className="app-shell"
      data-hydration-ready={draftReady ? "true" : "false"}
    >
      <div className="visually-hidden" aria-live="polite" aria-atomic="true">
        {stepAnnouncement}
      </div>
      {runtimeMissing && (
        <section className="account-panel" aria-live="polite">
          <div className="empty">
            {runtimeFailed ? (
              <>
                <b>資料載入失敗</b>
                <button
                  type="button"
                  onClick={() => {
                    if (!runtime.catalogDomain) safelyLoadCatalog();
                  }}
                >
                  重新載入
                </button>
              </>
            ) : (
              <b>正在載入資料…</b>
            )}
          </div>
        </section>
      )}

      {activeStep === 1 && (
        <AccountStep
          account={account}
          setAccount={setAccount}
          bindings={bindings}
          setBindings={setBindings}
          owned={owned}
          setOwned={setOwned}
          onToggleOwned={toggleOwned}
          updateOwned={updateOwned}
          setNotice={setNotice}
          draftAvailable={draftAvailable}
          runtime={runtime}
          onNext={() => goToStep(2)}
        />
      )}
      {activeStep === 2 && runtime.catalogDomain && (
        <CatalogStep
          runtime={runtime.catalogDomain}
          state={catalogStepState}
          owned={owned}
          onToggleOwned={toggleOwned}
          wardrobeConfirmed={account.wardrobeConfirmed}
          onWardrobeConfirmedChange={(wardrobeConfirmed) =>
            setAccount((previous) => ({ ...previous, wardrobeConfirmed }))
          }
          onBack={() => goToStep(1)}
          onNext={() => goToStep(3)}
        />
      )}
      {activeStep === 3 &&
        runtime.catalogDomain && (
          <ExportStep
            runtime={runtime.catalogDomain}
            state={exportStepState}
            account={account}
            bindings={bindings}
            owned={owned}
            setOwned={updateOwned}
            setNotice={setNotice}
            onBack={() => goToStep(2)}
            onClearAll={clearAllData}
          />
        )}

      {notice && (
        <div className="notice" role="status">
          {notice}
        </div>
      )}
      <footer>
        <span>
          資料來源：SkyGame-Data 1.3.10、SkyGame-Planner、Sky Wiki／BWiki
        </span>
      </footer>
    </main>
  );
}
