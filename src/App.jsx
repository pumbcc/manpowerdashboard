import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  Search,
  RefreshCw,
  Store,
  Users,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
} from "lucide-react";
import "./App.css";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function App() {
const [rows, setRows] = useState([]);
const [hourRows, setHourRows] = useState([]);
const [ceoAlerts, setCeoAlerts] = useState([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [brand, setBrand] = useState("All");
  const [region, setRegion] = useState("All");
  const [storeModel, setStoreModel] = useState("All");

async function loadData() {
  setLoading(true);
  setError("");

  const pageSize = 1000;
  let from = 0;
  let allRows = [];

  while (true) {
    const to = from + pageSize - 1;

    const { data, error } = await supabase
      .from("summary_manpower_gap")
      .select("*")
      .order("cost_center_code", { ascending: true })
      .range(from, to);

    if (error) {
      setError(error.message);
      setRows([]);
      setLoading(false);
      return;
    }

    allRows = [...allRows, ...(data || [])];

    if (!data || data.length < pageSize) {
      break;
    }

    from += pageSize;
  }

const { data: hourData, error: hourError } = await supabase
  .from("summary_manpower_hour_alert")
  .select("*")
  .order("cost_center_code", { ascending: true });

console.log("hourError", hourError);
console.log("hourData count", hourData?.length);
console.log("hourData sample", hourData?.slice(0, 10));
console.log(
  "hourData 1502010148",
  hourData?.filter(
    (r) => String(r.cost_center_code || "").trim() === "1502010148"
  )
);
if (hourError) {
  setError(hourError.message);
  setHourRows([]);
} else {
  setHourRows(hourData || []);
}
const { data: alertData, error: alertError } = await supabase
  .from("summary_ceo_manpower_alert")
  .select("*")
  .order("alert_level", { ascending: true })
  .order("total_paid_hours", { ascending: false });

if (alertError) {
  setError(alertError.message);
  setCeoAlerts([]);
} else {
  setCeoAlerts(alertData || []);
}
setRows(allRows);
setLoading(false);
}

  useEffect(() => {
    loadData();
  }, []);

  const filterOptions = useMemo(() => {
    return {
      brands: unique(rows.map((r) => r.brand)),
      regions: unique(rows.map((r) => r.region)),
      models: unique(rows.map((r) => r.store_model)),
    };
  }, [rows]);

  const filteredRows = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return rows.filter((r) => {
      const matchSearch =
        !keyword ||
        String(r.store_name_th || "").toLowerCase().includes(keyword) ||
        String(r.cost_center_code || "").toLowerCase().includes(keyword) ||
        String(r.manpower_position || "").toLowerCase().includes(keyword);

      return (
        matchSearch &&
        (brand === "All" || r.brand === brand) &&
        (region === "All" || r.region === region) &&
        (storeModel === "All" || r.store_model === storeModel)
      );
    });
  }, [rows, search, brand, region, storeModel]);

  const storeSummary = useMemo(() => {
    const map = new Map();

    filteredRows.forEach((r) => {
      const key = r.cost_center_code;

      if (!map.has(key)) {
        map.set(key, {
          cost_center_code: r.cost_center_code,
          store_name_th: r.store_name_th,
          brand: r.brand,
          region: r.region,
          store_model: r.store_model,
          store_grade: r.store_grade,
          plan: 0,
          existing: 0,
          gap: 0,
        });
      }

      const item = map.get(key);
      item.plan += Number(r.plan_headcount || 0);
      item.existing += Number(r.existing_headcount || 0);
      item.gap += Number(r.gap || 0);
    });

    return Array.from(map.values()).map((s) => ({
      ...s,
      coverage: s.plan > 0 ? (s.existing / s.plan) * 100 : 0,
    }));
  }, [filteredRows]);

  const kpi = useMemo(() => {
    const plan = filteredRows.reduce(
      (sum, r) => sum + Number(r.plan_headcount || 0),
      0
    );
    const existing = filteredRows.reduce(
      (sum, r) => sum + Number(r.existing_headcount || 0),
      0
    );
    const gap = existing - plan;
    const coverage = plan > 0 ? (existing / plan) * 100 : 0;

    return {
      plan,
      existing,
      gap,
      coverage,
      totalStores: storeSummary.length,
      shortageStores: storeSummary.filter((s) => s.gap < 0).length,
      overStores: storeSummary.filter((s) => s.gap > 0).length,
    };
  }, [filteredRows, storeSummary]);

  const topShortageStores = useMemo(() => {
    return [...storeSummary]
      .filter((s) => s.gap < 0)
      .sort((a, b) => a.gap - b.gap)
      .slice(0, 10);
  }, [storeSummary]);

  const topOverStores = useMemo(() => {
    return [...storeSummary]
      .filter((s) => s.gap > 0)
      .sort((a, b) => b.gap - a.gap)
      .slice(0, 10);
  }, [storeSummary]);

  const positionShortage = useMemo(() => {
    const map = new Map();

    filteredRows.forEach((r) => {
      const key = r.manpower_position;

      if (!map.has(key)) {
        map.set(key, {
          manpower_position: key,
          plan: 0,
          existing: 0,
          gap: 0,
        });
      }

      const item = map.get(key);
      item.plan += Number(r.plan_headcount || 0);
      item.existing += Number(r.existing_headcount || 0);
      item.gap += Number(r.gap || 0);
    });

    return Array.from(map.values())
      .map((p) => ({
        ...p,
        coverage: p.plan > 0 ? (p.existing / p.plan) * 100 : 0,
      }))
      .filter((p) => p.gap < 0)
      .sort((a, b) => a.gap - b.gap)
      .slice(0, 10);
  }, [filteredRows]);

  const missingRequired = useMemo(() => {
  return filteredRows
    .filter(
      (r) =>
        Number(r.plan_headcount || 0) > 0 &&
        Number(r.existing_headcount || 0) === 0
    )
    .slice(0, 20);
}, [filteredRows]);

const selectedStoreDetail = useMemo(() => {
  const keyword = search.trim().toLowerCase();

  if (!keyword) return [];

  const matchedStores = storeSummary.filter((s) => {
    return (
      String(s.cost_center_code || "").toLowerCase().includes(keyword) ||
      String(s.store_name_th || "").toLowerCase().includes(keyword)
    );
  });

  if (matchedStores.length !== 1) return [];

const selectedCostCenter = String(matchedStores[0].cost_center_code || "").trim();

return filteredRows
  .filter((r) => String(r.cost_center_code || "").trim() === selectedCostCenter)
    .sort((a, b) =>
      String(a.manpower_position || "").localeCompare(
        String(b.manpower_position || "")
      )
    );
}, [search, storeSummary, filteredRows]);
const selectedStoreHours = useMemo(() => {
  if (!selectedStoreDetail.length) return [];

  const selectedCostCenter = String(
    selectedStoreDetail[0]?.cost_center_code || ""
  ).trim();

  const matchedHours = hourRows.filter(
    (r) => String(r.cost_center_code || "").trim() === selectedCostCenter
  );

  console.log("selectedStoreDetail cost center", selectedCostCenter);
  console.log("hourRows total", hourRows.length);
  console.log("selectedStoreHours matched", matchedHours);

  return matchedHours.sort((a, b) =>
    String(a.manpower_group || "").localeCompare(
      String(b.manpower_group || "")
    )
  );
}, [hourRows, selectedStoreDetail]);

const filteredCeoAlerts = useMemo(() => {
  return ceoAlerts.filter((r) => {
    return (
      (brand === "All" || r.brand === brand) &&
      (region === "All" || r.region === region) &&
      (storeModel === "All" || r.store_model === storeModel)
    );
  });
}, [ceoAlerts, brand, region, storeModel]);

const ceoSummary = useMemo(() => {
  const scopedCostCenters = new Set(
    storeSummary.map((s) => String(s.cost_center_code || "").trim())
  );

  const scopedHourRows = hourRows.filter((r) =>
    scopedCostCenters.has(String(r.cost_center_code || "").trim())
  );

  const totalHours = scopedHourRows.reduce(
    (sum, r) => sum + Number(r.total_paid_hours || 0),
    0
  );

  const totalOt = scopedHourRows.reduce(
    (sum, r) =>
      sum +
      Number(r.ot15_hours || 0) +
      Number(r.ot2_hours || 0) +
      Number(r.ot3_hours || 0),
    0
  );

  const flexibleHours = scopedHourRows
    .filter((r) =>
      ["PT", "DVT", "EDC"].includes(String(r.manpower_group || "").trim())
    )
    .reduce((sum, r) => sum + Number(r.total_paid_hours || 0), 0);

  return {
    criticalStores: 0,
    warningStores: 0,
    totalHours,
    totalOt,
    flexibleHours,
    flexiblePercent: totalHours > 0 ? (flexibleHours / totalHours) * 100 : 0,
    otPercent: totalHours > 0 ? (totalOt / totalHours) * 100 : 0,
  };
}, [hourRows, storeSummary]);

const topLaborRiskStores = useMemo(() => {
  return filteredCeoAlerts
    .filter((r) => r.alert_level !== "Normal")
    .sort((a, b) => {
      const levelWeight = { Critical: 1, Warning: 2, Info: 3, Normal: 4 };
      return (
        (levelWeight[a.alert_level] || 9) - (levelWeight[b.alert_level] || 9) ||
        Number(b.total_paid_hours || 0) - Number(a.total_paid_hours || 0)
      );
    })
    .slice(0, 10);
}, [filteredCeoAlerts]);
const isStoreMode = selectedStoreDetail.length > 0;
  if (!supabaseUrl || !supabaseAnonKey) {
    return (
      <div className="page">
        <div className="error-box">
          Missing .env values. Please add VITE_SUPABASE_URL and
          VITE_SUPABASE_ANON_KEY.
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="header">
        <div>
          <div className="eyebrow">StoreFlow</div>
          <h1>CPO Manpower Dashboard</h1>
          <p>
            Plan vs Existing, shortage ranking, over-plan ranking, and position
            gap.
          </p>
        </div>

        <button className="refresh-button" onClick={loadData}>
          <RefreshCw size={18} />
          Refresh
        </button>
      </header>

      {error && <div className="error-box">{error}</div>}

      <section className="kpi-grid">
        <KpiCard icon={<Store />} label="Stores" value={fmt(kpi.totalStores)} />
        <KpiCard icon={<Users />} label="Plan HC" value={fmt(kpi.plan)} />
        <KpiCard icon={<Users />} label="Existing HC" value={fmt(kpi.existing)} />
        <KpiCard icon={<TrendingDown />} label="Total Gap" value={fmt(kpi.gap)} />
        <KpiCard
          icon={<AlertTriangle />}
          label="Coverage"
          value={`${fmt(kpi.coverage)}%`}
        />
        <KpiCard icon={<TrendingUp />} label="Over Stores" value={fmt(kpi.overStores)} />
      </section>

      <section className="filters">
        <div className="search-box">
          <Search size={18} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search store, cost center, position..."
          />
        </div>

        <Select
          value={brand}
          onChange={setBrand}
          options={["All", ...filterOptions.brands]}
        />
        <Select
          value={region}
          onChange={setRegion}
          options={["All", ...filterOptions.regions]}
        />
        <Select
          value={storeModel}
          onChange={setStoreModel}
          options={["All", ...filterOptions.models]}
        />
      </section>

      {!isStoreMode && (
        <>
          <section className="kpi-grid">
            <KpiCard
              icon={<AlertTriangle />}
              label="Critical Stores"
              value={fmt(ceoSummary.criticalStores)}
            />
            <KpiCard
              icon={<AlertTriangle />}
              label="Warning Stores"
              value={fmt(ceoSummary.warningStores)}
            />
            <KpiCard
              icon={<Users />}
              label="Total Paid Hours"
              value={fmt(ceoSummary.totalHours)}
            />
            <KpiCard
              icon={<TrendingUp />}
              label="Premium OT %"
              value={`${fmt(ceoSummary.otPercent)}%`}
            />
            <KpiCard
              icon={<Users />}
              label="Flexible Hours %"
              value={`${fmt(ceoSummary.flexiblePercent)}%`}
            />
            <KpiCard
              icon={<Store />}
              label="Stores in Scope"
              value={fmt(kpi.totalStores)}
            />
          </section>

          {topLaborRiskStores.length > 0 && (
            <section className="grid-one">
              <CeoAlertTable rows={topLaborRiskStores} />
            </section>
          )}
        </>
      )}

      {loading ? (
        <div className="card loading">Loading manpower data...</div>
      ) : (
        <>
          {isStoreMode && (
            <section className="grid-one">
              <StoreExecutiveAnalysis
                detailRows={selectedStoreDetail}
                hourRows={selectedStoreHours}
              />
            </section>
          )}

          {!isStoreMode && (
            <>
              <section className="grid-two">
                <RankingTable
                  title="Top Shortage Stores"
                  rows={topShortageStores}
                />
                <RankingTable
                  title="Top Over-Plan Stores"
                  rows={topOverStores}
                />
              </section>

              <section className="grid-two">
                <PositionTable rows={positionShortage} />
                <MissingRequiredTable rows={missingRequired} />
              </section>
            </>
          )}

          {selectedStoreDetail.length > 0 && (
            <section className="grid-one">
              <StoreDetailTable rows={selectedStoreDetail} />
            </section>
          )}

          {selectedStoreHours.length > 0 && (
            <section className="grid-one">
              <StoreHourAlertTable rows={selectedStoreHours} />
            </section>
          )}
        </>
      )}
    </div>
  );
}
function KpiCard({ icon, label, value }) {
  return (
    <div className="card kpi-card">
      <div className="kpi-icon">{icon}</div>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
    </div>
  );
}

function Select({ value, onChange, options }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

function RankingTable({ title, rows }) {
  return (
    <div className="card">
      <h2>{title}</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Store</th>
              <th>Brand</th>
              <th>Plan</th>
              <th>Existing</th>
              <th>Gap</th>
              <th>Coverage</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.cost_center_code}>
                <td>{i + 1}</td>
                <td>
                  <b>{r.store_name_th}</b>
                  <div className="subtext">
                    {r.cost_center_code} · {r.region} · {r.store_model}
                  </div>
                </td>
                <td>{r.brand}</td>
                <td>{fmt(r.plan)}</td>
                <td>{fmt(r.existing)}</td>
                <td className={r.gap < 0 ? "negative" : "positive"}>
                  {fmt(r.gap)}
                </td>
                <td>{fmt(r.coverage)}%</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan="7" className="empty">
                  No data
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PositionTable({ rows }) {
  return (
    <div className="card">
      <h2>Top Position Shortage</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Position</th>
              <th>Plan</th>
              <th>Existing</th>
              <th>Gap</th>
              <th>Coverage</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.manpower_position}>
                <td>
                  <b>{r.manpower_position}</b>
                </td>
                <td>{fmt(r.plan)}</td>
                <td>{fmt(r.existing)}</td>
                <td className="negative">{fmt(r.gap)}</td>
                <td>{fmt(r.coverage)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MissingRequiredTable({ rows }) {
  return (
    <div className="card">
      <h2>Missing Required Position</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Store</th>
              <th>Position</th>
              <th>Plan</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={`${r.cost_center_code}-${r.manpower_position}-${i}`}>
                <td>
                  <b>{r.store_name_th}</b>
                  <div className="subtext">
                    {r.cost_center_code} · {r.brand} · {r.region}
                  </div>
                </td>
                <td>{r.manpower_position}</td>
                <td>{fmt(r.plan_headcount)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan="3" className="empty">
                  No missing required position
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean))).sort();
}

function fmt(value) {
  return new Intl.NumberFormat("th-TH", {
    maximumFractionDigits: 1,
  }).format(Number(value || 0));
}

function buildStoreDiagnosis({
  totalGap,
  totalPlanHours,
  totalActualHours,
  premiumOtHours,
  ptHours,
  dvtHours,
  edcHours,
  flexiblePercent,
  otPercent,
}) {
  const items = [];

  const isOverHc = totalGap > 0;
  const isUnderHc = totalGap < 0;
  const hourGap = totalActualHours - totalPlanHours;
  const isOverHours = totalPlanHours > 0 && hourGap > totalPlanHours * 0.15;
  const hasPtUsage = ptHours > 0;
  const hasPremiumOt = premiumOtHours > 0;
  const hasHighOt = otPercent >= 10;
  const hasHighFlexible = flexiblePercent >= 50;

  if (isOverHc && hasPtUsage) {
    items.push({
      level: "Critical",
      title: "คนเกินแผน แต่ยังมีการใช้ PT",
      reason:
        "สาขามี Existing HC มากกว่า Plan HC แต่ยังมีชั่วโมงทำงานของ PT เกิดขึ้น อาจสะท้อนว่ามีคนชื่อค้าง คนเกินแต่ใช้ไม่ได้จริง หรือจัดกะไม่ตรงช่วงความต้องการ",
      action:
        "ตรวจสอบ PT ที่ถูกเรียกใช้งานก่อนเป็นลำดับแรก และเช็กว่าคนที่เกินแผนเป็นคนที่ใช้งานจริงหรือไม่",
    });
  }

  if (isOverHc && hasPremiumOt) {
    items.push({
      level: "Critical",
      title: "คนเกินแผน แต่ยังเกิด OT",
      reason:
        "แม้จำนวนคนมากกว่าแผน แต่ยังมี OT เกิดขึ้น แปลว่าการจัดกะ การกระจายชั่วโมง หรือ skill coverage อาจไม่เหมาะสม",
      action:
        "ตรวจสอบ roster รายวัน/รายกะ และดูว่ามีช่วงเวลาใดที่คนไม่พอจนต้องใช้ OT",
    });
  }

  if (isUnderHc && hasHighOt) {
    items.push({
      level: "Critical",
      title: "คนขาดแผน และ OT สูง",
      reason:
        "สาขามีจำนวนคนต่ำกว่าแผนและใช้ OT สูง อาจเป็นสัญญาณว่ากำลังคนไม่พอกับ workload จริง",
      action:
        "พิจารณาเติมคน หรือโยกคนจากสาขาที่เกินก่อนเพิ่ม OT ต่อเนื่อง",
    });
  }

  if (isOverHours) {
    items.push({
      level: "Warning",
      title: "ชั่วโมงทำงานจริงสูงกว่าแผน",
      reason:
        "Actual Paid Hours สูงกว่า Plan Hours มากกว่า 15% อาจเกิดจากเรียกคนเพิ่ม ใช้ OT หรือกะที่ตั้งไว้ไม่ตรงกับความต้องการจริง",
      action:
        "เทียบ Actual Hours กับ roster/ยอดขายรายวัน เพื่อหาวันหรือช่วงเวลาที่ใช้ชั่วโมงเกิน",
    });
  }

  if (hasHighFlexible && !isOverHc) {
    items.push({
      level: "Warning",
      title: "พึ่งพา PT/DVT/EDC สูง",
      reason:
        "สัดส่วนชั่วโมงของ Flexible Workforce สูง แม้ HC โดยรวมไม่ได้เกิน อาจเป็นกลยุทธ์ที่ตั้งใจ หรือสะท้อนว่า FT ไม่พอ/ไม่ตรงช่วงเวลา",
      action:
        "ตรวจสอบว่าสัดส่วน PT/DVT/EDC เป็นไปตาม model ของสาขาหรือไม่",
    });
  }

  if (!isOverHc && !isOverHours && !hasHighOt) {
    items.push({
      level: "Info",
      title: "ยังไม่พบปัญหาชัดจาก HC หรือชั่วโมงทำงาน",
      reason:
        "จำนวนคนและชั่วโมงทำงานไม่ได้เกินอย่างมีนัยสำคัญ หาก COL ยังสูง อาจไม่ได้เกิดจาก manpower volume แต่อาจเกิดจากฐานเงินเดือน ค่าแรงต่อชั่วโมง allowance หรือ cost component อื่น",
      action:
        "ต้องเชื่อมข้อมูล Actual COL / Payroll เพื่อยืนยันว่าเป็นปัญหา wage base หรือ cost per hour",
    });
  }

  if (!items.some((x) => x.title.includes("ฐานเงินเดือน"))) {
    items.push({
      level: "Info",
      title: "ยังไม่มีข้อมูลฐานเงินเดือนหรือ Actual COL",
      reason:
        "ระบบปัจจุบันวิเคราะห์ได้จาก HC และชั่วโมงทำงาน แต่ยังไม่สามารถฟันธงว่าค่าใช้จ่ายสูงเพราะฐานเงินเดือนของพนักงาน",
      action:
        "เพิ่มข้อมูล Actual COL หรือ cost per hour รายกลุ่ม เพื่อแยกสาเหตุระหว่างปริมาณชั่วโมงกับต้นทุนต่อชั่วโมง",
    });
  }

  return items;
}

function isPtPosition(position = "") {
  return String(position).toLowerCase().includes("(pt)");
}

function calcPlanHoursFromPosition(row) {
  const position = String(row.manpower_position || "");
  const planHeadcount = Number(row.plan_headcount || 0);

  // PT ใช้ตามชั่วโมงจริง ไม่ควรคำนวณจาก HC × 26 × 8
  if (isPtPosition(position)) return 0;

  return planHeadcount * 26 * 8;
}

function getHourStatus(actual, plan) {
  if (!plan || plan === 0) {
    if (actual > 0) return "Actual without plan";
    return "No plan";
  }

  const diffPercent = ((actual - plan) / plan) * 100;

  if (diffPercent >= 15) return "Over";
  if (diffPercent <= -15) return "Under";
  return "On track";
}

function StoreHourAlertTable({ rows }) {
  const store = rows[0];

  const totalActive = rows.reduce(
    (sum, r) => sum + Number(r.active_employees || 0),
    0
  );
  const totalHours = rows.reduce(
    (sum, r) => sum + Number(r.total_paid_hours || 0),
    0
  );

  return (
    <div className="card">
      <h2>Workforce Hours by Group</h2>

      <div className="store-detail-header">
        <div>
          <b>{store.store_name_th}</b>
          <div className="subtext">
            {store.cost_center_code} · {store.brand} · {store.region} ·{" "}
            {store.store_model}
          </div>
        </div>

        <div className="store-detail-summary">
          <span>
            Active Employees: <b>{fmt(totalActive)}</b>
          </span>
          <span>
            Total Paid Hours: <b>{fmt(totalHours)}</b>
          </span>
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Group</th>
              <th>Active Employees</th>
              <th>Work Hours</th>
              <th>OT1</th>
              <th>OT1.5</th>
              <th>OT2</th>
              <th>OT3</th>
              <th>Total Paid Hours</th>
              <th>Avg Hours / Active</th>
              <th>Alert</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={`${r.cost_center_code}-${r.manpower_group}`}>
                <td>
                  <b>{r.manpower_group || "-"}</b>
                </td>
                <td>{fmt(r.active_employees)}</td>
                <td>{fmt(r.work_hours)}</td>
                <td>{fmt(r.ot1_hours)}</td>
                <td>{fmt(r.ot15_hours)}</td>
                <td>{fmt(r.ot2_hours)}</td>
                <td>{fmt(r.ot3_hours)}</td>
                <td>
                  <b>{fmt(r.total_paid_hours)}</b>
                </td>
                <td>{fmt(r.avg_hours_per_active_employee)}</td>
                <td>
                  <span
                    className={
                      r.alert_message === "Normal"
                        ? "alert-normal"
                        : "alert-warning"
                    }
                  >
                    {r.alert_message}
                  </span>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan="10" className="empty">
                  No hour data
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
function CeoAlertTable({ rows }) {
  return (
    <div className="card">
      <h2>CPO Manpower Alerts</h2>
      <p className="section-subtitle">
        สาขาที่ควรตรวจสอบจากมุมชั่วโมงทำงาน, OT, flexible workforce และวันหยุด
      </p>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Level</th>
              <th>Store</th>
              <th>Reason</th>
              <th>Total Hours</th>
              <th>OT %</th>
              <th>Flexible %</th>
              <th>Gap</th>
              <th>Coverage</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={`${r.source_week}-${r.cost_center_code}`}>
                <td>
                  <span
                    className={
                      r.alert_level === "Critical"
                        ? "alert-critical"
                        : r.alert_level === "Warning"
                        ? "alert-warning"
                        : "alert-info"
                    }
                  >
                    {r.alert_level}
                  </span>
                </td>
                <td>
                  <b>{r.store_name_th}</b>
                  <div className="subtext">
                    {r.cost_center_code} · {r.brand} · {r.region} · {r.store_model}
                  </div>
                </td>
                <td>{r.alert_reason}</td>
                <td>{fmt(r.total_paid_hours)}</td>
                <td>{fmt(r.premium_ot_percent)}%</td>
                <td>{fmt(r.flexible_hours_percent)}%</td>
                <td className={Number(r.total_gap) < 0 ? "negative" : "positive"}>
                  {fmt(r.total_gap)}
                </td>
                <td>{fmt(r.coverage_percent)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StoreExecutiveAnalysis({ detailRows, hourRows }) {
  if (!detailRows.length) return null;

  const store = detailRows[0];

  const totalPlan = detailRows.reduce(
    (sum, r) => sum + Number(r.plan_headcount || 0),
    0
  );

  const totalExisting = detailRows.reduce(
    (sum, r) => sum + Number(r.existing_headcount || 0),
    0
  );

  const totalGap = totalExisting - totalPlan;
  const coverage = totalPlan > 0 ? (totalExisting / totalPlan) * 100 : 0;

  const totalPlanHours = detailRows.reduce(
    (sum, r) => sum + calcPlanHoursFromPosition(r),
    0
  );

  const totalActualHours = hourRows.reduce(
    (sum, r) => sum + Number(r.total_paid_hours || 0),
    0
  );

  const totalWorkHours = hourRows.reduce(
    (sum, r) => sum + Number(r.work_hours || 0),
    0
  );

  const premiumOtHours = hourRows.reduce(
    (sum, r) =>
      sum +
      Number(r.ot15_hours || 0) +
      Number(r.ot2_hours || 0) +
      Number(r.ot3_hours || 0),
    0
  );

  const ftHours = hourRows
    .filter((r) => r.manpower_group === "FT")
    .reduce((sum, r) => sum + Number(r.total_paid_hours || 0), 0);

  const ptHours = hourRows
    .filter((r) => r.manpower_group === "PT")
    .reduce((sum, r) => sum + Number(r.total_paid_hours || 0), 0);

  const dvtHours = hourRows
    .filter((r) => r.manpower_group === "DVT")
    .reduce((sum, r) => sum + Number(r.total_paid_hours || 0), 0);

  const edcHours = hourRows
    .filter((r) => r.manpower_group === "EDC")
    .reduce((sum, r) => sum + Number(r.total_paid_hours || 0), 0);

  const flexibleHours = ptHours + dvtHours + edcHours;

  const otPercent =
    totalActualHours > 0 ? (premiumOtHours / totalActualHours) * 100 : 0;

  const flexiblePercent =
    totalActualHours > 0 ? (flexibleHours / totalActualHours) * 100 : 0;

  const hourGap = totalActualHours - totalPlanHours;

  const hourCoverage =
    totalPlanHours > 0 ? (totalActualHours / totalPlanHours) * 100 : 0;

  const diagnosisItems = buildStoreDiagnosis({
  totalGap,
  totalPlanHours,
  totalActualHours,
  premiumOtHours,
  ptHours,
  dvtHours,
  edcHours,
  flexiblePercent,
  otPercent,
});

const planVsActualByGroup = ["FT", "PT", "DVT", "EDC"].map((group) => {
  const planRows = detailRows.filter((r) => {
    const position = String(r.manpower_position || "");

    if (group === "PT") return position.includes("(PT)");
    if (group === "DVT") return position.includes("(DVT)") || position.includes("Dual Vocational");
    if (group === "EDC") return position.includes("(EDC)") || position.includes("Education Center");

    // FT = ทุกตำแหน่งที่ไม่ใช่ PT / DVT / EDC
    return (
      !position.includes("(PT)") &&
      !position.includes("(DVT)") &&
      !position.includes("(EDC)") &&
      !position.includes("Dual Vocational") &&
      !position.includes("Education Center")
    );
  });

  const planHeadcount = planRows.reduce(
    (sum, r) => sum + Number(r.plan_headcount || 0),
    0
  );

  const existingHeadcount = planRows.reduce(
    (sum, r) => sum + Number(r.existing_headcount || 0),
    0
  );

  const planHours = planRows.reduce(
    (sum, r) => sum + calcPlanHoursFromPosition(r),
    0
  );

  const actualHours = hourRows
    .filter((h) => String(h.manpower_group || "") === group)
    .reduce((sum, h) => sum + Number(h.total_paid_hours || 0), 0);

  return {
    group,
    planHeadcount,
    existingHeadcount,
    planHours,
    actualHours,
    hourGap: actualHours - planHours,
    status: getHourStatus(actualHours, planHours),
  };
});

  const edcDvtPlanHours = detailRows
    .filter((r) => {
      const p = String(r.manpower_position || "");
      return p.includes("(EDC)") || p.includes("(DVT)");
    })
    .reduce((sum, r) => sum + calcPlanHoursFromPosition(r), 0);

  const edcDvtActualHours = dvtHours + edcHours;

  let level = "Normal";
  let insight = "ภาพรวมกำลังคนและชั่วโมงทำงานอยู่ในระดับปกติ";

  if (totalGap < 0 && otPercent >= 10) {
    level = "Critical";
    insight =
      "สาขานี้มีคนต่ำกว่าแผนและมี OT สูง อาจสะท้อนว่ากำลังคนไม่พอกับภาระงานจริง";
  } else if (hourCoverage >= 115) {
    level = "Critical";
    insight =
      "ชั่วโมงทำงานจริงสูงกว่าแผนมาก ควรตรวจสอบการจัดกะ การเรียก PT และ OT";
  } else if (otPercent >= 15) {
    level = "Critical";
    insight =
      "สัดส่วน OT สูง ควรตรวจสอบการจัดกะ การเรียกคน และช่วงเวลาพีคของสาขา";
  } else if (flexiblePercent >= 50) {
    level = "Warning";
    insight =
      "ชั่วโมงทำงานพึ่งพา PT/DVT/EDC สูง ควรตรวจสอบว่าเป็นกลยุทธ์ที่ตั้งใจ หรือเกิดจาก FT ไม่พอ";
  } else if (totalGap > 0 && totalActualHours === 0) {
    level = "Warning";
    insight =
      "จำนวนคนในระบบสูงกว่าแผน แต่ยังไม่พบชั่วโมงทำงาน อาจเป็นกลุ่มที่มีชื่อค้างหรือยังไม่ถูกเรียกใช้งาน";
  } else if (hourCoverage <= 85 && totalPlanHours > 0) {
    level = "Warning";
    insight =
      "ชั่วโมงทำงานจริงต่ำกว่าแผน อาจเกิดจากพนักงานมีชื่อในแผนแต่ไม่ได้ถูกใช้งานจริง หรือข้อมูล attendance ยังไม่ครบ";
  }

  return (
    <div className="card store-exec-card">
      <div className="store-exec-title">
        <div>
          <h2>Store Executive Analysis</h2>
          <div className="subtext">
            {store.store_name_th} · {store.cost_center_code} · {store.brand} ·{" "}
            {store.region} · {store.store_model}
          </div>
        </div>

        <span
          className={
            level === "Critical"
              ? "alert-critical"
              : level === "Warning"
              ? "alert-warning"
              : "alert-normal"
          }
        >
          {level}
        </span>
      </div>

      <div className="exec-summary-grid">
        <div className="exec-metric">
          <div className="exec-label">Plan HC</div>
          <div className="exec-value">{fmt(totalPlan)}</div>
          <div className="exec-sub">Existing {fmt(totalExisting)}</div>
        </div>

        <div className="exec-metric">
          <div className="exec-label">HC Gap</div>
          <div className={totalGap < 0 ? "exec-value negative" : "exec-value positive"}>
            {fmt(totalGap)}
          </div>
          <div className="exec-sub">Coverage {fmt(coverage)}%</div>
        </div>

        <div className="exec-metric highlight">
          <div className="exec-label">Plan Hours</div>
          <div className="exec-value">{fmt(totalPlanHours)}</div>
          <div className="exec-sub">HC × 26 days × 8 hrs</div>
        </div>

        <div className="exec-metric highlight">
          <div className="exec-label">Actual Paid Hours</div>
          <div className={hourGap > 0 ? "exec-value negative" : "exec-value positive"}>
            {fmt(totalActualHours)}
          </div>
          <div className="exec-sub">
            Gap {hourGap > 0 ? "+" : ""}
            {fmt(hourGap)} hrs · {fmt(hourCoverage)}%
          </div>
        </div>
      </div>

      <div className="exec-insight">
        <b>Executive Insight:</b> {insight}
      </div>

          <div className="exec-panel">
  <h3>Root Cause Diagnosis</h3>

  <div className="diagnosis-list">
    {diagnosisItems.map((item, index) => (
      <div className="diagnosis-item" key={`${item.title}-${index}`}>
        <div className="diagnosis-head">
          <span
            className={
              item.level === "Critical"
                ? "alert-critical"
                : item.level === "Warning"
                ? "alert-warning"
                : "alert-info"
            }
          >
            {item.level}
          </span>
          <b>{item.title}</b>
        </div>

        <div className="diagnosis-text">
          <b>เหตุผล:</b> {item.reason}
        </div>

        <div className="diagnosis-action">
          <b>ควรทำก่อน:</b> {item.action}
        </div>
      </div>
    ))}
  </div>
</div>

      <div className="exec-split-grid">
        <div className="exec-panel">
          <h3>Hour Mix</h3>

          <div className="mix-row">
            <span>FT Hours</span>
            <b>{fmt(ftHours)}</b>
          </div>
          <div className="mix-row">
            <span>PT Hours</span>
            <b>{fmt(ptHours)}</b>
          </div>
          <div className="mix-row">
            <span>DVT Hours</span>
            <b>{fmt(dvtHours)}</b>
          </div>
          <div className="mix-row">
            <span>EDC Hours</span>
            <b>{fmt(edcHours)}</b>
          </div>
          <div className="mix-row strong">
            <span>Flexible Hours %</span>
            <b>{fmt(flexiblePercent)}%</b>
          </div>
        </div>

        <div className="exec-panel">
          <h3>Risk Signals</h3>

          <div className="mix-row">
            <span>Work Hours</span>
            <b>{fmt(totalWorkHours)}</b>
          </div>
          <div className="mix-row">
            <span>Premium OT Hours</span>
            <b>{fmt(premiumOtHours)}</b>
          </div>
          <div className="mix-row strong">
            <span>Premium OT %</span>
            <b>{fmt(otPercent)}%</b>
          </div>
          <div className="mix-row">
            <span>EDC/DVT Plan Hours</span>
            <b>{fmt(edcDvtPlanHours)}</b>
          </div>
          <div className="mix-row">
            <span>EDC/DVT Actual Hours</span>
            <b>{fmt(edcDvtActualHours)}</b>
          </div>
        </div>
      </div>

      <div className="exec-panel">
     <h3>Plan Hours vs Actual Hours by Group</h3>

<div className="table-wrap">
  <table>
    <thead>
      <tr>
        <th>Group</th>
        <th>Plan HC</th>
        <th>Existing HC</th>
        <th>Plan Hours</th>
        <th>Actual Hours</th>
        <th>Hour Gap</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>
      {planVsActualByGroup.map((r) => (
        <tr key={r.group}>
          <td>
            <b>{r.group}</b>
          </td>
          <td>{fmt(r.planHeadcount)}</td>
          <td>{fmt(r.existingHeadcount)}</td>
          <td>{fmt(r.planHours)}</td>
          <td>{fmt(r.actualHours)}</td>
          <td className={r.hourGap > 0 ? "negative" : "positive"}>
            {r.hourGap > 0 ? "+" : ""}
            {fmt(r.hourGap)}
          </td>
          <td>
            <span
              className={
                r.status === "Over"
                  ? "alert-critical"
                  : r.status === "Under"
                  ? "alert-warning"
                  : "alert-normal"
              }
            >
              {r.status}
            </span>
          </td>
        </tr>
      ))}
    </tbody>
  </table>
</div>

<p className="exec-note">
  หมายเหตุ: ตารางนี้เทียบระดับกลุ่มพนักงานก่อน เพราะข้อมูลชั่วโมงปัจจุบันสรุปอยู่ที่ FT / PT / DVT / EDC ยังไม่ได้แยก Actual Hours รายตำแหน่งละเอียด
</p>
      </div>
    </div>
  );
}

function StoreDetailTable({ rows }) {
  const store = rows[0];

  const totalPlan = rows.reduce((sum, r) => sum + Number(r.plan_headcount || 0), 0);
  const totalExisting = rows.reduce((sum, r) => sum + Number(r.existing_headcount || 0), 0);
  const totalGap = totalExisting - totalPlan;
  const totalCoverage = totalPlan > 0 ? (totalExisting / totalPlan) * 100 : 0;

  return (
    <div className="card">
      <h2>Store Position Detail</h2>

      <div className="store-detail-header">
        <div>
          <b>{store.store_name_th}</b>
          <div className="subtext">
            {store.cost_center_code} · {store.brand} · {store.region} · {store.store_model}
          </div>
        </div>

        <div className="store-detail-summary">
          <span>Plan: <b>{fmt(totalPlan)}</b></span>
          <span>Existing: <b>{fmt(totalExisting)}</b></span>
          <span>Gap: <b className={totalGap < 0 ? "negative" : "positive"}>{fmt(totalGap)}</b></span>
          <span>Coverage: <b>{fmt(totalCoverage)}%</b></span>
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Position</th>
              <th>Plan</th>
              <th>Existing</th>
              <th>Gap</th>
              <th>Coverage</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={`${r.cost_center_code}-${r.manpower_position}`}>
                <td>
                  <b>{r.manpower_position}</b>
                </td>
                <td>{fmt(r.plan_headcount)}</td>
                <td>{fmt(r.existing_headcount)}</td>
                <td className={Number(r.gap) < 0 ? "negative" : Number(r.gap) > 0 ? "positive" : ""}>
                  {fmt(r.gap)}
                </td>
                <td>
                  {r.coverage_percent === null || r.coverage_percent === undefined
                    ? "-"
                    : `${fmt(r.coverage_percent)}%`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}