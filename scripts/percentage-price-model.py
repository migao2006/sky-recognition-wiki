"""Explainable offline listing model: season baseline times learned percentages."""
from collections import Counter
import numpy as np
from scipy.optimize import minimize, LinearConstraint

# User-selected community opinions, not listing observations or sold prices.
# Midpoints for quoted ranges; gratitude is the selected 300k lower anchor.
ANCHORS = {'gratitude': 300000, 'lightseekers': 150000, 'rhythm': 85000,
           'enchantment': 35000, 'sanctuary': 15000, 'prophecy': 10000}
BREAKS = {'none': 0, 'slight': 1, 'medium': 2, 'large': 3}
PACKAGES = {'few': 0, 'medium': 1, 'many': 2, 'hundred': 3}
RESOURCES = ('candles', 'hearts', 'ascended', 'passes')


class PercentagePriceModel:
    def fit(self, rows, seasons, anchors=None):
        if not rows or len(set(seasons)) != len(seasons):
            raise ValueError('Require training rows and unique seasons')
        if any(r.get('priceKind') not in ('ask', 'sold_proxy') or
               not np.isfinite(r['price']) or r['price'] <= 0 or
               r.get('knownAnswer') or r.get('excludeFromModel') or
               r.get('currency') != 'TWD' or r.get('market') != 'taiwan' for r in rows):
            raise ValueError('Require eligible Taiwan listing prices')
        self.seasons = list(seasons)
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
            bounds[i] = (np.log(v), np.log(v))
            initial[i] = np.log(v)
        # Earlier season cannot be cheaper under identical remaining conditions.
        order = np.zeros((max(0, len(seasons) - 1), n))
        for i in range(len(order)):
            order[i, i], order[i, i + 1] = 1, -1
        # Weak baseline smoothing fills missing seasons, strong effect shrinkage
        # reduces sparse binding/resource confounding. Neither is a price sample.
        penalty = np.diag([0.] * self.nbase + [10.] * (n - self.nbase)) + .5 * order.T @ order
        def objective(w):
            residual = x @ w - y
            return .5 * (residual @ residual + w @ penalty @ w), x.T @ residual + penalty @ w
        result = minimize(objective, initial, jac=True, bounds=bounds,
                          constraints=[LinearConstraint(order, 0, np.inf)], method='SLSQP',
                          options={'maxiter': 1000, 'ftol': 1e-9})
        if not result.success:
            raise ValueError('Percentage fit failed: ' + result.message)
        self.weights = result.x
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
