"""Explainable offline listing model: season baseline times learned percentages."""
from collections import Counter
import numpy as np
from scipy.optimize import minimize, LinearConstraint

# User-selected community opinions, not listing observations or sold prices.
# User-selected centers; bounded mode allows gratitude 270k–330k too.
ANCHORS = {'gratitude': 300000, 'lightseekers': 150000, 'rhythm': 85000,
           'enchantment': 35000, 'sanctuary': 15000, 'prophecy': 10000}
BREAKS = {'none': 0, 'slight': 1, 'medium': 2, 'large': 3}
PACKAGES = {'few': 0, 'medium': 1, 'many': 2, 'hundred': 3}
RESOURCES = ('candles', 'hearts', 'ascended', 'passes')


class PercentagePriceModel:
    def fit(self, rows, seasons, anchors=None, *, adjust_baselines=False,
            bounded_baselines=False, effect_regularization=10., season_smoothing=.5):
        if adjust_baselines and bounded_baselines:
            raise ValueError('Free adjustment cannot override bounded baselines')
        if any(isinstance(v, bool) or not isinstance(v, (int, float)) or
               not np.isfinite(v) or v <= 0 for v in (effect_regularization, season_smoothing)):
            raise ValueError('Regularization must be positive and finite')
        if not rows or not seasons or len(set(seasons)) != len(seasons):
            raise ValueError('Require training rows and unique seasons')
        if any(r.get('priceKind') not in ('ask', 'sold_proxy') or
               not np.isfinite(r['price']) or r['price'] <= 0 or
               r.get('knownAnswer') or r.get('excludeFromModel') or r.get('exclude_from_model') or
               r.get('currency') != 'TWD' or r.get('market') != 'taiwan' for r in rows):
            raise ValueError('Require eligible Taiwan listing prices')
        self.seasons = list(seasons)
        self.baseline_mode = 'bounded' if bounded_baselines else 'adjustable' if adjust_baselines else 'fixed'
        self.fit_params = dict(bounded_baselines=bounded_baselines,
                               effect_regularization=effect_regularization, season_smoothing=season_smoothing)
        self.anchors = {k: v for k, v in (ANCHORS if anchors is None else anchors).items()
                        if k in seasons}
        if any(not np.isfinite(v) or v <= 0 for v in self.anchors.values()):
            raise ValueError('Invalid baseline')
        counts = Counter((k, str(v)) for r in rows for k, v in r.get('features', {}).items()
                         if k.startswith('binding:') and v is not None and str(v) != 'unknown')
        self.bindings = sorted(k for k, n in counts.items() if n >= 5)
        self.resources = [k for k in RESOURCES if sum(self._number(r, k) is not None for r in rows) >= 5]
        self.nbase = len(seasons) + 1  # Unknown season is separate, never the latest season.
        x = self._matrix(rows)
        y = np.log([r['price'] for r in rows])
        n = x.shape[1]
        bounds = [(None, None)] * self.nbase + [(None, 0)] * 3 + [(0, None)] * 3
        bounds += [(None, None)] * len(self.bindings) + [(0, None)] * len(self.resources)
        initial = np.zeros(n)
        initial[:self.nbase] = np.median(y)
        for k, v in self.anchors.items():
            i = seasons.index(k)
            bounds[i] = (np.log(v * .9), np.log(v * 1.1)) if bounded_baselines else (np.log(v), np.log(v))
            initial[i] = np.log(v)
        self.baseline_support = {}
        reference = None
        if adjust_baselines:
            # Reference is fitted on this training fold, never the full dataset.
            reference = PercentagePriceModel().fit(rows, seasons, anchors)
            initial = reference.weights.copy()
            # Remove floating-point inversions at tied monotone baselines before
            # fixing sparse seasons as equality bounds in the second fit.
            initial[:len(seasons)] = np.minimum.accumulate(np.round(initial[:len(seasons)], 10))
            for i, season in enumerate(seasons):
                members = [r for r in rows if r.get('season') == season]
                groups = {r.get('splitGroup') or r.get('accountKey') for r in members}
                groups.discard(None)
                conditions = {(r['breakClass'], r['packageTier']) for r in members
                              if r.get('breakClass') in BREAKS and r.get('packageTier') in PACKAGES}
                eligible = len(groups) >= 5 and len(conditions) >= 2
                self.baseline_support[season] = dict(groups=len(groups), conditions=len(conditions), adjustable=eligible)
                bounds[i] = (None, None) if eligible else (initial[i], initial[i])
        # Earlier season cannot be cheaper under identical remaining conditions.
        order = np.zeros((max(0, len(seasons) - 1), n))
        for i in range(len(order)):
            order[i, i], order[i, i + 1] = 1, -1
        # Weak baseline smoothing fills missing seasons, strong effect shrinkage
        # reduces sparse binding/resource confounding. Neither is a price sample.
        penalty = np.diag([0.] * self.nbase + [effect_regularization] * (n - self.nbase)) + season_smoothing * order.T @ order
        prior = np.zeros(n)
        if reference is not None:
            for i, season in enumerate(seasons):
                if self.baseline_support[season]['adjustable']:
                    penalty[i, i] += 2
                    prior[i] = 2 * reference.weights[i]
        def objective(w):
            residual = x @ w - y
            scale = len(rows) if adjust_baselines or bounded_baselines else 1
            return (.5 * (residual @ residual + w @ penalty @ w) - prior @ w) / scale, (x.T @ residual + penalty @ w - prior) / scale
        result = minimize(objective, initial, jac=True, bounds=bounds,
                          constraints=[LinearConstraint(order, 0, np.inf)] if len(order) else [], method='SLSQP',
                          options={'maxiter': 1000, 'ftol': 1e-9})
        if not result.success:
            raise ValueError('Percentage fit failed: ' + result.message)
        self.weights = result.x
        if not np.all(np.isfinite(self.weights)) or np.any(order @ self.weights < -1e-7):
            raise ValueError('Invalid fitted season direction')
        if any((lo is not None and self.weights[i] < lo - 1e-7) or
               (hi is not None and self.weights[i] > hi + 1e-7)
               for i, (lo, hi) in enumerate(bounds)):
            raise ValueError('Fitted model violates bounds')
        return self

    @staticmethod
    def _number(row, key):
        v = row.get('features', {}).get(key)
        return float(v) if isinstance(v, (int, float)) and not isinstance(v, bool) and np.isfinite(v) and v >= 0 else None

    def _matrix(self, rows):
        matrix = []
        for r in rows:
            base = np.zeros(self.nbase)
            base[self.seasons.index(r['season']) if r.get('season') in self.seasons else -1] = 1
            b, p = BREAKS.get(r.get('breakClass')), PACKAGES.get(r.get('packageTier'))
            breaks = [float(b >= j) if b is not None else 0. for j in (1, 2, 3)]
            # Geometric midpoint of medium and many = 100%, not zero packages.
            packages = [float(p >= j) - ref if p is not None else 0.
                        for j, ref in zip((1, 2, 3), (1., .5, 0.))]
            f = r.get('features', {})
            bindings = [float(str(f.get(k)) == v) for k, v in self.bindings]
            resources = [np.log1p(self._number(r, k) or 0) for k in self.resources]
            matrix.append([*base, *breaks, *packages, *bindings, *resources])
        return np.asarray(matrix, dtype=float)

    def explain(self, rows):
        terms = self._matrix(rows) * self.weights
        b = self.nbase
        end = b + 6 + len(self.bindings)
        result = []
        for r, t in zip(rows, terms):
            factors = dict(breaks=float(np.exp(t[b:b+3].sum())),
                           packages=float(np.exp(t[b+3:b+6].sum())),
                           bindings=float(np.exp(t[b+6:end].sum())),
                           resources=float(np.exp(t[end:].sum())))
            base = float(np.exp(t[:b].sum()))
            price = base * float(np.prod(list(factors.values())))
            if not np.isfinite(price) or price <= 0:
                raise ValueError('Invalid percentage prediction')
            result.append(dict(basePrice=base, factors=factors, price=price,
                               seasonKnown=r.get('season') in self.seasons,
                               breakKnown=r.get('breakClass') in BREAKS,
                               packageKnown=r.get('packageTier') in PACKAGES))
        return result

    def predict(self, rows):
        return np.array([e['price'] for e in self.explain(rows)])
