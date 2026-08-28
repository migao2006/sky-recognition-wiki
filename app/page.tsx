"use client";

import { useCallback, useEffect, useState } from "react";
import { AccountStep } from "./account-step";
import {
  emptyBindings,
  type AccountInfo,
  type BindingKey,
  type BindingStatus,
} from "./account-config";
import { CatalogStep, useCatalogStepState } from "./catalog-step";
import { useAccountDraft } from "./use-account-draft";
import { useOrganizerRuntime } from "./use-organizer-runtime";
import { ValuationStep, useValuationStepState } from "./valuation-step";

const emptyAccount = (): AccountInfo => ({
  name: "",
  accountType: "有翼",
  bindingsConfirmed: false,
  candles: "",
  hearts: "",
  ascended: "",
  passes: "",
  bindingNote: "",
  notes: "",
});

export default function AccountOrganizer() {
  const [activeStep, setActiveStep] = useState<1 | 2 | 3>(1);
  const [owned, setOwned] = useState<Set<string>>(new Set());
  const [account, setAccount] = useState<AccountInfo>(emptyAccount);
  const [bindings, setBindings] =
    useState<Record<BindingKey, BindingStatus>>(emptyBindings);
  const [notice, setNotice] = useState("");
  const catalogStepState = useCatalogStepState();
  const valuationStepState = useValuationStepState();
  const runtime = useOrganizerRuntime(setOwned);
  const { loadCatalog, loadValuation } = runtime;
  const { draftAvailable, clearStoredDraft } = useAccountDraft({
    account,
    bindings,
    owned,
    validGuids: runtime.catalogValidGuids,
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

  const toggleOwned = useCallback((guid: string) => {
    setOwned((previous) => {
      const next = new Set(previous);
      if (next.has(guid)) next.delete(guid);
      else next.add(guid);
      return next;
    });
  }, []);

  const safelyLoadCatalog = useCallback(() => {
    void loadCatalog().catch(() => undefined);
  }, [loadCatalog]);
  const safelyLoadValuation = useCallback(() => {
    void loadValuation().catch(() => undefined);
  }, [loadValuation]);

  const goToStep = (step: 1 | 2 | 3) => {
    if (step === activeStep) return;
    if (step !== 1) safelyLoadCatalog();
    if (step === 3) safelyLoadValuation();
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

  const runtimeMissing =
    activeStep !== 1 &&
    (!runtime.catalogDomain || (activeStep === 3 && !runtime.valuationRuntime));
  const runtimeFailed =
    runtime.catalogLoadError ||
    (activeStep === 3 && runtime.valuationLoadError);

  return (
    <main className="app-shell">
      <nav className="workflow-steps" aria-label="帳號整理步驟">
        {[
          [1, "帳號資料"],
          [2, "選擇物品"],
          [3, "估價與匯出"],
        ].map(([step, label]) => (
          <button
            type="button"
            className={activeStep === step ? "active" : ""}
            aria-current={activeStep === step ? "step" : undefined}
            key={step}
            onClick={() => goToStep(step as 1 | 2 | 3)}
          >
            <i>{step}</i>
            <span>{label}</span>
          </button>
        ))}
      </nav>

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
                    if (activeStep === 3 && !runtime.valuationRuntime) {
                      safelyLoadValuation();
                    }
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
          setNotice={setNotice}
          draftAvailable={draftAvailable}
          runtime={runtime}
          onNext={() => goToStep(2)}
        />
      )}
      {activeStep === 2 && runtime.catalogDomain && (
        <CatalogStep
          runtime={runtime}
          state={catalogStepState}
          owned={owned}
          onToggleOwned={toggleOwned}
          onBack={() => goToStep(1)}
          onNext={() => goToStep(3)}
        />
      )}
      {activeStep === 3 &&
        runtime.catalogDomain &&
        runtime.valuationRuntime && (
          <ValuationStep
            runtime={runtime}
            state={valuationStepState}
            account={account}
            setAccount={setAccount}
            bindings={bindings}
            setBindings={setBindings}
            owned={owned}
            setOwned={setOwned}
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
          資料來源：SkyGame-Data 1.3.8、SkyGame-Planner、Sky Wiki／BWiki（核對於
          2026-08-25）
        </span>
      </footer>
    </main>
  );
}
