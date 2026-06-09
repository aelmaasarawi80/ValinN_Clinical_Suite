import React, { useState, useEffect, useRef } from 'react';

// Configuration: Backend fallback URL
const BACKEND_URL = "[https://validn-backend.onrender.com](https://validn-backend.onrender.com)"; //valinn-clinical-suite.onrender.com";

export default function App() {
  const [currentStep, setCurrentStep] = useState(1);
  const [errorMsg, setErrorMsg] = useState("");
  const [isCalculating, setIsCalculating] = useState(false);

  // Administrative / Workflow details
  const [topic, setTopic] = useState("General Patient Satisfaction");
  const [unit, setUnit] = useState("patient"); // patient, tooth
  const [mode, setMode] = useState("descriptive"); // descriptive, comparative

  // Study Setup Parameters
  const [indepVars, setIndepVars] = useState(1);
  const [factorialGoal, setFactorialGoal] = useState("main");
  const [numGroups, setNumGroups] = useState(2);
  const [primaryOutcome, setPrimaryOutcome] = useState("");
  const [dataType, setDataType] = useState("continuous");
  const [multipleOutcomes, setMultipleOutcomes] = useState(1);
  const [groupNames, setGroupNames] = useState(["Group A", "Group B"]);

  // Evidence Inputs
  const [dataSource, setDataSource] = useState("paper");
  const [cohenEffect, setCohenEffect] = useState(0.5);
  const [sd, setSd] = useState("");
  const [paperDoi, setPaperDoi] = useState("");
  const [means, setMeans] = useState(["", ""]);
  const [proportions, setProportions] = useState(["", ""]);

  // Clinical Logistics Settings
  const [deffVal, setDeffVal] = useState(1.0);
  const [population, setPopulation] = useState("");
  const [applyFpc, setApplyFpc] = useState(true);
  const [responseRate, setResponseRate] = useState(75);
  const [applyCc, setApplyCc] = useState(true);
  const [confidenceLevel, setConfidenceLevel] = useState(0.95);
  const [power, setPower] = useState(0.80);

  // Descriptive Specifics
  const [prevProp, setPrevProp] = useState(50);
  const [ciWidth, setCiWidth] = useState(0.05);

  // Results State
  const [results, setResults] = useState(null);
  const [simulatedPower, setSimulatedPower] = useState(80);
  const [simulatedN, setSimulatedN] = useState(10);
  const [rigorScore, setRigorScore] = useState({ score: 10, label: "Excellent", color: "text-emerald-500", advice: "" });

  const canvasRef = useRef(null);

  const handleGroupUIChange = (val) => {
    const count = parseInt(val);
    setNumGroups(count);
    let arr = [];
    if (count === 1) {
      arr = ["Target Population"];
    } else {
      for (let i = 0; i < count; i++) {
        arr.push(`Treatment ${String.fromCharCode(65 + i)}`);
      }
    }
    setGroupNames(arr);
  };

  const handleGroupNamesChange = (idx, val) => {
    const updated = [...groupNames];
    updated[idx] = val;
    setGroupNames(updated);
  };

  const selectUnitOfAnalysis = (val) => {
    setUnit(val);
    if (val === 'patient') {
      setDeffVal(1.0);
    } else {
      setDeffVal(1.5);
    }
  };

  const handleStep3Complete = () => {
    if (groupNames.some(g => g.trim() === "")) {
      setErrorMsg("Please provide valid names for all study groups.");
      return;
    }
    setErrorMsg("");
    setMeans(Array(numGroups).fill(""));
    setProportions(Array(numGroups).fill(""));
    setCurrentStep(4);
  };

  const applyPreset = (preset) => {
    if (numGroups === 1) return;
    const count = numGroups;
    const spreadValues = (max, min) => {
      return Array(count).fill(0).map((_, i) => {
        if (count === 1) return max;
        const v = max - i * ((max - min) / (count - 1));
        return parseFloat(v.toFixed(1));
      });
    };

    if (preset === "pain") {
        setSd(2.1);
        setMeans(spreadValues(4.5, 2.0));
    } else if (preset === "fatigue") {
        setSd(85);
        setMeans(spreadValues(580, 450));
    } else if (preset === "pushout") {
        setSd(2.5);
        setMeans(spreadValues(14.2, 10.5));
    }
  };

  const openPubMed = () => {
    let groupStr = groupNames.map(g => `("${g}")`).join(" AND ");
    if (!groupStr) groupStr = '("Dental") AND ("Treatment")';
    const query = `${groupStr} AND ("${primaryOutcome}")`;
    const url = `https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(query)}`;
    window.open(url, '_blank');
  };

  // Rational Approximation for Inverse Cumulative Normal Distribution (BSM/Abramowitz)
  const normSInvLocal = (p) => {
    if (p <= 0 || p >= 1) return (p <= 0) ? -Infinity : Infinity;
    const a1 = -39.6968302866538, a2 = 220.946098424521, a3 = -275.928510446969, a4 = 138.357751867269, a5 = -30.6647980661472, a6 = 2.50662827745924;
    const b1 = -54.4760987982241, b2 = 161.585836858041, b3 = -155.698979859887, b4 = 66.8013118877197, b5 = -13.2806815528857;
    const c1 = -0.00778489400243029, c2 = -0.322396458041136, c3 = -2.40075827716184, c4 = -2.54973253934373, c5 = 4.37466414146497, c6 = 2.93816398269878;
    const d1 = 0.00778469570904146, d2 = 0.32246712907004, d3 = 2.445134137143, d4 = 3.75440866190742;
    const p_low = 0.02425, p_high = 1 - p_low;
    let q, r;
    if (p < p_low) { q = Math.sqrt(-2 * Math.log(p)); return (((((c1 * q + c2) * q + c3) * q + c4) * q + c5) * q + c6) / ((((d1 * q + d2) * q + d3) * q + d4) * q + 1); } 
    else if (p <= p_high) { q = p - 0.5; r = q * q; return (((((a1 * r + a2) * r + a3) * r + a4) * r + a5) * r + a6) * q / (((((b1 * r + b2) * r + b3) * r + b4) * r + b5) * r + 1); } 
    else { q = Math.sqrt(-2 * Math.log(1 - p)); return -(((((c1 * q + c2) * q + c3) * q + c4) * q + c5) * q + c6) / ((((d1 * q + d2) * q + d3) * q + d4) * q + 1); }
  };

  const normalCDFLocal = (x) => {
    let t = 1 / (1 + 0.2316419 * Math.abs(x));
    let d = 0.3989423 * Math.exp(-x * x / 2);
    let p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
    return x > 0 ? 1 - p : p;
  };

  const chiSqInvLocal = (alpha, df) => {
    let z = Math.abs(normSInvLocal(1 - alpha));
    return df * Math.pow(1 - (2 / (9 * df)) + z * Math.sqrt(2 / (9 * df)), 3);
  };

  const findOmnibusNLocal = (alpha, targetPower, groups, effectSize) => {
    let df = groups - 1;
    let xc = chiSqInvLocal(alpha, df);
    let n_total = groups + 1;
    let currentPower = 0;
    while (currentPower < targetPower && n_total < 50000) {
      n_total++;
      let lambda = n_total * Math.pow(effectSize, 2);
      let z = (xc - (df + lambda)) / Math.sqrt(2 * (df + 2 * lambda));
      currentPower = normalCDFLocal(-z);
    }
    return Math.ceil(n_total / groups);
  };

  const runLocalCalculation = () => {
    const alphaVal = 1.0 - confidenceLevel;
    let n_per_group = 0;
    let report = "";
    let calc_delta = 0;
    let calc_sd = 1;
    let effect_size = 0;

    let pairwiseComps = numGroups > 2 ? (numGroups * (numGroups - 1)) / 2 : 1;
    let omnibusAlpha = alphaVal / multipleOutcomes;
    let postHocAlpha = alphaVal / (multipleOutcomes * pairwiseComps);

    const zBeta = Math.abs(normSInvLocal(1.0 - power));
    const zOmnibusAlpha = Math.abs(normSInvLocal(1.0 - (omnibusAlpha / 2)));
    const zPostHocAlpha = Math.abs(normSInvLocal(1.0 - (postHocAlpha / 2)));

    let doiCitation = paperDoi ? ` (DOI: ${paperDoi})` : "";

    if (numGroups === 1) {
      const p = prevProp / 100.0;
      const d = ciWidth;
      const zAlpha = normSInvLocal(1 - alphaVal / 2);
      n_per_group = Math.ceil((Math.pow(zAlpha, 2) * p * (1 - p)) / Math.pow(d, 2));
      // REPLACE LINE 188 WITH THIS:
report = `The sample size was calculated to evaluate the descriptive prevalence of ${primaryOutcome} in ${groupNames[0]}. To achieve a ±${(d * 100).toFixed(0)}% margin of error with ${(confidenceLevel * 100).toFixed(0)}% confidence, assuming expected prevalence of ${prevProp}%${doiCitation} (Cochran, 1977), the baseline calculation required ${n_per_group} total samples.`;
    } else {
      if (dataSource === "none") {
        let eff = parseFloat(cohenEffect);
        calc_delta = eff;
        if (numGroups > 2) {
          let f = eff / 2.0;
          effect_size = f;
          let n_omnibus = findOmnibusNLocal(omnibusAlpha, power, numGroups, f);
          let n_pairwise = Math.ceil((2 * Math.pow(zPostHocAlpha + zBeta, 2)) / Math.pow(eff, 2));
          n_per_group = Math.max(n_pairwise, n_omnibus);
        } else {
          n_per_group = Math.ceil((2 * Math.pow(zPostHocAlpha + zBeta, 2)) / Math.pow(eff, 2));
          effect_size = eff;
        }
        let sizeText = eff === 0.8 ? "large" : (eff === 0.5 ? "moderate" : "small");
        report = `As formal pilot data was unavailable, calculations utilized Cohen's standardized effect size guidelines (Cohen, 1988). The study was powered to detect a clinically ${sizeText} difference across ${numGroups} group(s), actively ensuring adequate power for both omnibus and pairwise evaluations. `;
      } else {
        if (dataType === "binary") {
          let props = proportions.map(p => parseFloat(p) / 100.0);
          let p_max = Math.max(...props);
          let p_min = Math.min(...props);
          calc_delta = Math.abs(p_max - p_min);
          calc_sd = Math.sqrt((p_max * (1 - p_max) + p_min * (1 - p_min)) / 2.0);

          let n_pairwise = Math.ceil(((zPostHocAlpha + zBeta) ** 2 * (p_max * (1 - p_max) + p_min * (1 - p_min))) / (calc_delta ** 2));
          if (numGroups > 2) {
            let grandP = props.reduce((a, b) => a + b, 0) / props.length;
            let w_sum = props.reduce((sum, p) => sum + Math.pow(p - grandP, 2) / (grandP * (1.0 - grandP)), 0);
            let w = Math.sqrt((1.0 / numGroups) * w_sum);
            effect_size = w;
            let n_omnibus = findOmnibusNLocal(omnibusAlpha, power, numGroups, w);
            n_per_group = Math.max(n_pairwise, n_omnibus);
            report = `Sample size was established utilizing an omnibus Chi-Square framework. Based on the expected proportions${doiCitation}, Cohen's w effect size was calculated at ${w.toFixed(3)}. The mathematical model dynamically maxed calculations to ensure adequate power for both the omnibus test and subsequent pairwise comparisons. `;
          } else {
            n_per_group = n_pairwise;
            effect_size = calc_delta / calc_sd;
            report = `Sample size was calculated based on expected outcome proportions between ${(p_max * 100).toFixed(1)}% and ${(p_min * 100).toFixed(1)}%${doiCitation}. `;
          }
        } else {
          let numericMeans = means.map(Number);
          let m_max = Math.max(...numericMeans);
          let m_min = Math.min(...numericMeans);
          let numericSd = parseFloat(sd);
          calc_delta = Math.abs(m_max - m_min);
          calc_sd = numericSd;

          let n_pairwise = Math.ceil((2 * Math.pow(numericSd, 2) * Math.pow(zPostHocAlpha + zBeta, 2)) / Math.pow(calc_delta, 2));
          if (numGroups > 2) {
            let grandMean = numericMeans.reduce((a, b) => a + b, 0) / numericMeans.length;
            let varMeans = numericMeans.reduce((sum, m) => sum + Math.pow(m - grandMean, 2), 0) / numericMeans.length;
            let f = Math.sqrt(varMeans / Math.pow(numericSd, 2));
            effect_size = f;
            let n_omnibus = findOmnibusNLocal(omnibusAlpha, power, numGroups, f);
            n_per_group = Math.max(n_pairwise, n_omnibus);
            report = `Sample size was established utilizing an omnibus analysis of variance framework. Based on the provided means and standard deviation of ${numericSd}${doiCitation}, Cohen's f effect size was calculated at ${f.toFixed(3)}. The model ensured adequate power for both the global test and specific pairwise post-hoc comparisons. `;
          } else {
            effect_size = calc_delta / numericSd;
            n_per_group = n_pairwise;
            report = `Based on expected outcome means of ${m_max} and ${m_min} with a standard deviation of ${numericSd}${doiCitation}. `;
          }

          if (dataType === 'ordinal') {
            n_per_group = Math.ceil(n_per_group / 0.955);
            report += `As the outcome utilizes an ordinal scale, an Asymptotic Relative Efficiency (ARE) adjustment (~4.7% sample inflation) was mathematically applied to preserve non-parametric statistical power for Kruskal-Wallis/Mann-Whitney models (Lehmann, 1975). `;
          }
        }
      }
      let statJustification = `To achieve ${(power*100).toFixed(0)}% statistical power with a ${(confidenceLevel*100).toFixed(0)}% global confidence level`;
      if (multipleOutcomes > 1 || numGroups > 2) {
        statJustification += `, a stringent family-wise Bonferroni correction was applied for ${multipleOutcomes} co-primary outcome(s) and ${pairwiseComps} pairwise comparison(s) (adjusted post-hoc alpha = ${postHocAlpha.toFixed(4)}) to strictly control Type I error inflation (Julious, 2004)`;
      } else {
        statJustification += " (alpha = 0.05)";
      }
      report += `${statJustification}, requiring a baseline calculation of ${n_per_group} samples per group. `;
    }

    let baseline_n = n_per_group;
    let current_n = baseline_n;

    let n_fact = 0;
    if (indepVars > 1) {
      if (factorialGoal === "interaction") {
        n_fact = current_n * 3;
        current_n += n_fact;
        report += `Because the study evaluates multiple independent factors simultaneously, the sample size was multiplied by 4 to preserve power to detect the omnibus interaction effect (Brookes et al., 2001). `;
      } else {
        report += `The calculation was powered strictly for main effects; testing for interaction effects is exploratory. `;
      }
    }

    let n_deff = 0;
    if (deffVal > 1.0) {
      n_deff = Math.ceil(current_n * deffVal) - current_n;
      current_n += n_deff;
      report += `A Design Effect multiplier of ${deffVal} was applied to account for intra-cluster correlation. `;
    }

    let n_fpc = 0;
    if (population && applyFpc && parseInt(population) > 0) {
      let pop = parseInt(population);
      let corrected = Math.ceil((current_n * pop) / (current_n + pop - 1));
      n_fpc = current_n - corrected;
      current_n = corrected;
      report += `A finite population correction was applied assuming a total accessible census of ${pop}. `;
    }

    let n_att = 0;
    if (responseRate < 100) {
      let final_inflated = Math.ceil(current_n / (responseRate / 100.0));
      n_att = final_inflated - current_n;
      current_n = final_inflated;
      report += `Finally, to buffer against an expected ${(100 - responseRate)}% clinical attrition or non-response rate, the required target was inflated. `;
    }

    let total_n = current_n if numGroups === 1 else current_n * numGroups;
    report += `Therefore, the final target sample size for this study is ${total_n} ` + (numGroups === 1 ? `participants.` : `(${current_n} per group).`);

    return {
      baseline_n,
      final_n_per_group: current_n,
      total_n,
      n_fact,
      n_deff,
      n_fpc,
      n_att,
      calc_delta,
      calc_sd,
      effect_size,
      academic_report: report,
      pairwise_comps: pairwiseComps,
      post_hoc_alpha: postHocAlpha,
      omnibus_alpha: omnibusAlpha
    };
  };

  const calculateFinalSize = async () => {
    setErrorMsg("");
    setIsCalculating(true);

    const payload = {
      indepVars,
      factorialGoal,
      numGroups,
      outcomesCount: parseInt(multipleOutcomes),
      dataType,
      dataSource,
      groupNames,
      deffVal: parseFloat(deffVal),
      population: population ? parseInt(population) : null,
      responseRate: responseRate / 100.0,
      paperDoi: paperDoi || null
    };

    if (numGroups === 1) {
      payload.prevProp = parseFloat(prevProp);
      payload.ciWidth = parseFloat(ciWidth);
    } else {
      if (dataSource === "none") {
        payload.cohenEffect = parseFloat(cohenEffect);
      } else {
        if (dataType === "binary") {
          if (proportions.some(p => p === "" || isNaN(p))) {
            setErrorMsg("Please fill out expected percentages for all groups.");
            setIsCalculating(false);
            return;
          }
          payload.proportions = proportions.map(Number);
        } else {
          if (means.some(m => m === "" || isNaN(m)) || !sd || isNaN(sd)) {
            setErrorMsg("Please fill out Expected Means and the Standard Deviation.");
            setIsCalculating(false);
            return;
          }
          payload.means = means.map(Number);
          payload.sd = parseFloat(sd);
        }
      }
    }

    try {
      const response = await fetch(`${BACKEND_URL}/api/calculate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error();
      }

      const data = await response.json();
      setResults(data);
      setSimulatedN(data.final_n_per_group);
      calculateRigorScore(data);
      setCurrentStep(5);
    } catch {
      // API fallback - execute exact math locally inside client browser
      const data = runLocalCalculation();
      setResults(data);
      setSimulatedN(data.final_n_per_group);
      calculateRigorScore(data);
      setCurrentStep(5);
    } finally {
      setIsCalculating(false);
    }
  };

  const calculateRigorScore = (data) => {
    let score = 10.0;
    let adviceList = [];

    if (!paperDoi && dataSource !== "none") {
      score -= 1.5;
      adviceList.push("Pasting a valid paper DOI connects your parameters to historical evidence, reinforcing ethics board validation.");
    }
    if (responseRate < 70) {
      score -= 1.0;
      adviceList.push("A response rate lower than 70% introduces non-response bias. Try implementing telephone follow-ups.");
    }
    if (unit === "tooth" && deffVal === 1.0) {
      score -= 3.0;
      adviceList.push("CRITICAL error: Tooth-level analysis violates independence. You must apply a Design Effect (DEFF) adjustment.");
    }
    if (numGroups > 2 && indepVars > 1 && factorialGoal === "main") {
      score -= 1.0;
      adviceList.push("Factorial main effects are calculated, but any interaction tests will be severely underpowered.");
    }
    if (mode === "comparative" && applyFpc) {
      score -= 1.5;
      adviceList.push("Applying Finite Population Correction (FPC) to comparative models is scientifically debated (Deming, 1953).");
    }

    score = Math.max(1.0, parseFloat(score.toFixed(1)));
    let label = "High Academic Rigor";
    let color = "text-emerald-500 border-emerald-500 bg-emerald-50";
    if (score < 5.0) {
      label = "Insufficient Rigor (Do not publish)";
      color = "text-rose-500 border-rose-500 bg-rose-50";
    } else if (score < 8.0) {
      label = "Borderline Rigor (Needs justification)";
      color = "text-amber-500 border-warning bg-amber-50";
    }

    setRigorScore({ score, label, color, advice: adviceList.join(" ") || "Your protocol matches excellent biostatistical design standards. Defensible for high-impact publication." });
  };

  useEffect(() => {
    if (currentStep !== 5 || !results || numGroups === 1) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    ctx.scale(2, 2);

    const d = results.calc_delta / results.calc_sd;
    const width = rect.width;
    const height = rect.height;
    ctx.clearRect(0, 0, width, height);

    const scaleX = width / 6; 
    const center1 = width / 2 - (d * scaleX / 2);
    const center2 = width / 2 + (d * scaleX / 2);

    const drawCurve = (centerX, color, fill) => {
        ctx.beginPath();
        for(let x = 0; x < width; x += 2) {
            let z = (x - centerX) / scaleX;
            let y = height - (Math.exp(-0.5 * z * z) * height * 0.85);
            if(x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.lineTo(width, height); ctx.lineTo(0, height);
        ctx.fillStyle = fill; ctx.fill();
        ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.stroke();
    };

    drawCurve(center1, '#2563eb', 'rgba(37, 99, 235, 0.12)'); 
    if(numGroups > 2) {
        drawCurve(width / 2, '#8b5cf6', 'rgba(139, 92, 246, 0.12)'); 
    }
    drawCurve(center2, '#10b981', 'rgba(16, 185, 129, 0.12)'); 
  }, [currentStep, results, numGroups]);

  const updatePowerGauge = (nSim) => {
    if (!results || numGroups === 1) return;
    setSimulatedN(nSim);

    let fact_div = (indepVars > 1 && factorialGoal === "interaction") ? 4.0 : 1.0;
    let n_eff_group = (nSim * (responseRate / 100)) / (deffVal * fact_div);
    let n_eff_total = n_eff_group * numGroups;

    const normSInvLocal = (p) => {
        let a1 = -39.69, a2 = 220.94, a3 = -275.92, b1 = -54.47, b2 = 161.58, b3 = -155.69;
        let q = p - 0.5; let r = q * q;
        return (((a1 * r + a2) * r + a3) * q / (((b1 * r + b2) * r + b3) * r + 1));
    };
    const normalCDFLocal = (x) => {
        let t = 1 / (1 + 0.2316419 * Math.abs(x));
        let d = 0.3989423 * Math.exp(-x * x / 2);
        let p = d * t * (0.31938 + t * (-0.3565 + t * (1.7814 + t * (-1.8212 + t * 1.3302))));
        return x > 0 ? 1 - p : p;
    };

    const zAlphaPairwise = Math.abs(normSInvLocal(1.0 - (results.post_hoc_alpha / 2)));
    let zBeta_sim = Math.sqrt((n_eff_group * Math.pow(results.calc_delta, 2)) / (2 * Math.pow(results.calc_sd, 2))) - zAlphaPairwise;
    let power_sim = normalCDFLocal(zBeta_sim) * 100;

    if (numGroups > 2 && results.effect_size) {
        let df = numGroups - 1;
        let z = Math.abs(normSInvLocal(1 - results.omnibus_alpha));
        let xc = df * Math.pow(1 - (2 / (9 * df)) + z * Math.sqrt(2 / (9 * df)), 3);
        let lambda = n_eff_total * Math.pow(results.effect_size, 2);
        let z_omn = (xc - (df + lambda)) / Math.sqrt(2 * (df + 2 * lambda));
        let power_omn = normalCDFLocal(-z_omn) * 100;
        power_sim = Math.min(power_sim, power_omn);
    }

    setSimulatedPower(Math.max(1, Math.min(99.9, power_sim)));
  };

  const copyDashboardImage = async () => {
    const btn = document.getElementById('copyBtn');
    btn.innerText = 'Capturing Layout...';
    const element = document.getElementById('exportable-dashboard');
    try {
        const canvas = await html2canvas(element, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
        canvas.toBlob(async (blob) => {
            const item = new ClipboardItem({ "image/png": blob });
            await navigator.clipboard.write([item]);
            btn.innerText = '✅ Copied to Clipboard!';
            setTimeout(() => { btn.innerText = 'Copy for Word/PPT'; }, 2000);
        });
    } catch (e) {
        btn.innerText = '❌ Clipboard Denied';
        setTimeout(() => { btn.innerText = 'Copy for Word/PPT'; }, 2000);
    }
  };

  return (
    <div className="w-full max-w-4xl bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden">
      
      {/* Wizard Step Navigation */}
      <div className="flex bg-slate-50 border-b border-slate-100">
        {[1, 2, 3, 4, 5].map((s) => (
          <div key={s} className={`flex-1 text-center py-5 text-xs font-bold transition-all duration-300 border-b-2 uppercase tracking-wider ${currentStep === s ? 'text-blue-600 bg-blue-50/50 border-blue-600' : 'text-slate-400 border-transparent'}`}>
            {s === 1 ? 'Design' : s === 2 ? 'Outcomes' : s === 3 ? 'Groups' : s === 4 ? 'Evidence' : 'Dashboard'}
          </div>
        ))}
      </div>

      {/* STEP 1: Study Design */}
      {currentStep === 1 && (
        <div className="p-10 animate-fade-in">
          <h2 className="text-3xl font-extrabold text-slate-800 tracking-tight mb-2">Establish Study Architecture</h2>
          <p className="text-slate-500 mb-8">Define your research framework and baseline settings securely.</p>

          <label className="text-sm font-bold text-slate-700 uppercase tracking-wide block mb-3">Independent Variables (Factors)</label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className={`p-6 rounded-2xl border-2 transition-all cursor-pointer ${indepVars === 1 ? 'border-blue-600 bg-blue-50/30' : 'border-slate-100 bg-slate-50/50'}`} onClick={() => setIndepVars(1)}>
              <h4 className="font-bold text-slate-800 text-lg mb-1">1 Variable</h4>
              <p className="text-sm text-slate-500">Comparing simple clinical groups (e.g. Sealer A vs Sealer B).</p>
            </div>
            <div className={`p-6 rounded-2xl border-2 transition-all cursor-pointer ${indepVars === 2 ? 'border-blue-600 bg-blue-50/30' : 'border-slate-100 bg-slate-50/50'}`} onClick={() => setIndepVars(2)}>
              <h4 className="font-bold text-slate-800 text-lg mb-1">2+ Variables (Factorial)</h4>
              <p className="text-sm text-slate-500">Cross-comparing multiple variables simultaneously.</p>
            </div>
          </div>

          {indepVars > 1 && (
            <div className="p-5 rounded-2xl bg-amber-50 border border-amber-200 mb-6">
              <h4 className="text-amber-800 font-bold mb-2">🔬 Factorial Calculation Scope</h4>
              <select className="w-full p-3 bg-white border border-amber-200 rounded-xl" value={factorialGoal} onChange={(e) => setFactorialGoal(e.target.value)}>
                <option value="main">Standard Main Effects only (Standard Sample Size)</option>
                <option value="interaction">Synergistic Interaction Proof (Sample Size x4 Multiplier)</option>
              </select>
            </div>
          )}

          <label className="text-sm font-bold text-slate-700 uppercase tracking-wide block mb-3">Unit of Analysis</label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className={`p-6 rounded-2xl border-2 transition-all cursor-pointer ${unit === 'patient' ? 'border-blue-600 bg-blue-50/30' : 'border-slate-100 bg-slate-50/50'}`} onClick={() => selectUnitOfAnalysis('patient')}>
              <h4 className="font-bold text-slate-800 text-lg mb-1">Patient-Level</h4>
              <p className="text-sm text-slate-500">Each patient is independent (No clustering adjustments required).</p>
            </div>
            <div className={`p-6 rounded-2xl border-2 transition-all cursor-pointer ${unit === 'tooth' ? 'border-blue-600 bg-blue-50/30' : 'border-slate-100 bg-slate-50/50'}`} onClick={() => selectUnitOfAnalysis('tooth')}>
              <h4 className="font-bold text-slate-800 text-lg mb-1">Tooth-Level (Clustered)</h4>
              <p className="text-sm text-slate-500">Multiple teeth measured inside the same mouth. Automatically applies DEFF adjustments.</p>
            </div>
          </div>

          <label className="text-sm font-bold text-slate-700 uppercase tracking-wide block mb-3">How many Specific Treatment Groups?</label>
          <select className="w-full p-4 border border-slate-200 rounded-xl bg-slate-50/50 text-slate-800" value={numGroups} onChange={(e) => handleGroupUIChange(e.target.value)}>
            <option value={1}>1 Group (Prevalence / Descriptive Survey)</option>
            <option value={2}>2 Groups (Standard Hypothesis Testing)</option>
            <option value={3}>3 Groups</option>
            <option value={4}>4 Groups</option>
            <option value={5}>5+ Groups</option>
          </select>

          <div className="flex justify-end mt-8 border-t border-slate-100 pt-6">
            <button className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-blue-600/20" onClick={() => setCurrentStep(2)}>Next Step ➔</button>
          </div>
        </div>
      )}

      {/* STEP 2: Outcomes */}
      {currentStep === 2 && (
        <div className="p-10 animate-fade-in">
          <h2 className="text-3xl font-extrabold text-slate-800 tracking-tight mb-2">Identify Outcome Metrics</h2>
          <p className="text-slate-500 mb-8">Define your primary outcome measure. This dictates your mathematical distribution model.</p>

          <label className="text-sm font-bold text-slate-700 uppercase tracking-wide block mb-3">Name of Primary Outcome Measure</label>
          <input type="text" className="w-full p-4 border border-slate-200 rounded-xl bg-slate-50/50" placeholder="e.g. Post-operative pain" value={primaryOutcome} onChange={(e) => setPrimaryOutcome(e.target.value)} />

          <label className="text-sm font-bold text-slate-700 uppercase tracking-wide block mb-3">Outcome Data Type</label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className={`p-6 rounded-2xl border-2 transition-all cursor-pointer text-center ${dataType === 'continuous' ? 'border-blue-600 bg-blue-50/30' : 'border-slate-100 bg-slate-50/50'}`} onClick={() => setDataType('continuous')}>
              <h4 className="font-bold text-slate-800 text-lg mb-1">Continuous</h4>
              <p className="text-xs text-slate-500 mt-2">Exact measurements (e.g. pocket depth in mm, prep time).</p>
            </div>
            <div className={`p-6 rounded-2xl border-2 transition-all cursor-pointer text-center ${dataType === 'binary' ? 'border-blue-600 bg-blue-50/30' : 'border-slate-100 bg-slate-50/50'}`} onClick={() => setDataType('binary')}>
              <h4 className="font-bold text-slate-800 text-lg mb-1">Binary</h4>
              <p className="text-xs text-slate-500 mt-2">Pass/Fail percentages (e.g. lesion healed or failed).</p>
            </div>
            <div className={`p-6 rounded-2xl border-2 transition-all cursor-pointer text-center ${dataType === 'ordinal' ? 'border-blue-600 bg-blue-50/30' : 'border-slate-100 bg-slate-50/50'}`} onClick={() => setDataType('ordinal')}>
              <h4 className="font-bold text-slate-800 text-lg mb-1">Ordinal</h4>
              <p className="text-xs text-slate-500 mt-2">Ordered scales (e.g. Mild/Mod/Severe pain ratings).</p>
            </div>
          </div>

          {dataType === 'ordinal' && (
            <div className="p-5 rounded-2xl bg-amber-50 border border-amber-200 mb-6 text-amber-800 text-sm leading-relaxed">
              <h4 className="font-bold mb-1">📊 Non-Parametric ARE Adjustments</h4>
              ValidN will calculate sample requirements continuously, then apply an Asymptotic Relative Efficiency inflation (+4.7%) to safely protect Kruskal-Wallis/Mann-Whitney power thresholds (Lehmann, 1975).
            </div>
          )}

          <label className="text-sm font-bold text-slate-700 uppercase tracking-wide block mb-3">Tracking Multiple Outcomes?</label>
          <select className="w-full p-4 border border-slate-200 rounded-xl bg-slate-50/50 text-slate-800" value={multipleOutcomes} onChange={(e) => setMultipleOutcomes(Number(e.target.value))}>
            <option value={1}>No, just 1 primary outcome (Standard)</option>
            <option value={2}>Yes, 2 outcomes (Bonferroni alpha-split applied)</option>
            <option value={3}>Yes, 3 outcomes (aggressive alpha conservation)</option>
          </select>

          <div className="flex justify-between mt-8 border-t border-slate-100 pt-6">
            <button className="px-8 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold" onClick={() => setCurrentStep(1)}>⬅ Back</button>
            <button className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold" onClick={() => { if(!primaryOutcome) { alert("Please name your primary outcome."); return; } setCurrentStep(3); }}>Next Step ➔</button>
          </div>
        </div>
      )}

      {/* STEP 3: Groups */}
      {currentStep === 3 && (
        <div className="p-10 animate-fade-in">
          <h2 className="text-3xl font-extrabold text-slate-800 tracking-tight mb-2">Identify Treatment Groups</h2>
          <p className="text-slate-500 mb-8">Assign distinct labels to your clinical comparisons to personalize your report.</p>

          <div className="flex flex-col gap-4">
            {groupNames.map((name, idx) => (
              <div key={idx} className="form-group">
                <label className="text-sm font-bold text-slate-700 uppercase tracking-wide block mb-2">Name of Group {idx + 1}</label>
                <input type="text" className="w-full p-4 border border-slate-200 rounded-xl bg-slate-50/50" value={name} onChange={(e) => handleGroupNamesChange(idx, e.target.value)} />
              </div>
            ))}
          </div>

          <div className="flex justify-between mt-8 border-t border-slate-100 pt-6">
            <button className="px-8 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold" onClick={() => setCurrentStep(2)}>⬅ Back</button>
            <button className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold" onClick={handleStep3Complete}>Next Step ➔</button>
          </div>
        </div>
      )}

      {/* STEP 4: Evidence */}
      {currentStep === 4 && (
        <div className="p-10 animate-fade-in">
          <h2 className="text-3xl font-extrabold text-slate-800 tracking-tight mb-2">Establish Expected Variances</h2>
          <p className="text-slate-500 mb-8">Input values from historical literature or pilot data to drive the power calculation.</p>

          {numGroups > 1 && (
            <div className="mb-6">
              <label className="text-sm font-bold text-slate-700 uppercase tracking-wide block mb-3">Expected Data Origin</label>
              <select className="w-full p-4 border border-slate-200 rounded-xl bg-slate-50/50" value={dataSource} onChange={(e) => setDataSource(e.target.value)}>
                <option value="paper">📚 Published Paper / Pilot Data</option>
                <option value="preset">⚡ Standard Dental Presets</option>
                <option value="none">🔮 No literature exists (Cohen effect threshold)</option>
              </select>
            </div>
          )}

          {dataSource === "preset" && numGroups > 1 && (
            <div className="p-6 rounded-2xl bg-blue-50/50 border border-blue-100 mb-6">
              <label className="text-sm font-bold text-slate-700 uppercase tracking-wide block mb-3">Select a Standard Clinical Metric</label>
              <select className="w-full p-3 bg-white border border-blue-200 rounded-xl text-slate-800 font-medium" onChange={(e) => applyPreset(e.target.value)}>
                <option value="">-- Choose preset --</option>
                <option value="pain">Post-operative Pain (VAS 0-10, pooled SD=2.1)</option>
                <option value="fatigue">NCF Fatigue Resistance (NCF, pooled SD=85)</option>
                <option value="pushout">Push-out Bond Strength (MPa, pooled SD=2.5)</option>
              </select>
            </div>
          )}

          {dataSource === "paper" && numGroups > 1 && (
            <div className="mb-6">
              <div className="p-6 rounded-2xl bg-emerald-50 border border-emerald-100 text-center mb-6">
                <h4 className="font-bold text-emerald-800 text-lg mb-1">Dynamic Literature Crawler</h4>
                <p className="text-sm text-emerald-700 mb-4">Find similar clinical papers directly on PubMed utilizing your exact keywords.</p>
                <button className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition-all shadow-md shadow-emerald-600/20" onClick={openPubMed}>🔍 Search PubMed Now</button>
              </div>
              <div className="p-6 rounded-2xl border border-slate-200 bg-slate-50/50 font-serif text-sm leading-relaxed mb-6 text-slate-700 shadow-inner">
                <strong>Abstract Data Decoder Help:</strong><br/>
                "...Group A reported a mean value of <span className="highlight-mean px-1 rounded bg-yellow-100 font-bold">42.5</span> <span className="highlight-sd px-1.5 rounded bg-orange-100 font-bold">± 8.2</span> compared to Group B which showed <span className="highlight-mean px-1 rounded bg-yellow-100 font-bold">36.1</span> <span className="highlight-sd px-1.5 rounded bg-orange-100 font-bold">± 7.9</span>..."
              </div>
              <div className="p-6 rounded-2xl border border-slate-200 bg-slate-50/30 mb-6">
                <label className="text-sm font-bold text-slate-700 uppercase tracking-wide block mb-2">Source paper DOI (For Automated Reference Citations)</label>
                <input type="text" className="w-full p-3 border border-slate-200 rounded-xl bg-white text-slate-800" placeholder="e.g. 10.1016/j.joen.2023.01.001" value={paperDoi} onChange={(e) => setPaperDoi(e.target.value)} />
              </div>
            </div>
          )}

          {dataSource === "none" && numGroups > 1 && (
            <div className="mb-6 p-6 rounded-2xl border border-slate-100 bg-slate-50/50">
              <label className="text-sm font-bold text-slate-700 uppercase tracking-wide block mb-3">Standardized Effect Size (Cohen, 1988)</label>
              <select className="w-full p-4 bg-white border border-slate-200 rounded-xl" value={cohenEffect} onChange={(e) => setCohenEffect(parseFloat(e.target.value))}>
                <option value={0.8}>Large effect (Highly distinct outcomes, requires smaller sample)</option>
                <option value={0.5}>Moderate effect (Accepted clinical standard compromise)</option>
                <option value={0.2}>Small effect (Subtle change, requires large sample size)</option>
              </select>
            </div>
          )}

          {numGroups === 1 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <label className="text-sm font-bold text-slate-700 uppercase tracking-wide block mb-2">Expected Prevalence (%)</label>
                <input type="number" className="w-full p-4 border border-slate-200 rounded-xl bg-slate-50/50" value={prevProp} onChange={(e) => setPrevProp(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-bold text-slate-700 uppercase tracking-wide block mb-2">Margin of Error (Precision)</label>
                <select className="w-full p-4 border border-slate-200 rounded-xl bg-slate-50/50" value={ciWidth} onChange={(e) => setCiWidth(parseFloat(e.target.value))}>
                  <option value={0.05}>± 5% (Standard Academic)</option>
                  <option value={0.03}>± 3% (High Precision)</option>
                  <option value={0.01}>± 1% (Extreme Precision)</option>
                </select>
              </div>
            </div>
          )}

          {numGroups > 1 && dataSource !== "none" && (
            <div className="mb-6">
              {dataType === "binary" ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {groupNames.map((g, idx) => (
                    <div key={idx}>
                      <label className="text-xs font-bold text-slate-600 block mb-1">{g} Proportion (%)</label>
                      <input type="number" className="w-full p-3 border border-slate-200 rounded-xl bg-white text-sm" placeholder="e.g. 65" value={proportions[idx]} onChange={(e) => {
                        const updated = [...proportions]; updated[idx] = e.target.value; setProportions(updated);
                      }} />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col gap-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {groupNames.map((g, idx) => (
                      <div key={idx}>
                        <label className="text-xs font-bold text-slate-600 block mb-1">{g} Mean</label>
                        <input type="number" className="w-full p-3 border border-slate-200 rounded-xl bg-white text-sm" placeholder="e.g. 42.5" value={means[idx]} onChange={(e) => {
                          const updated = [...means]; updated[idx] = e.target.value; setMeans(updated);
                        }} />
                      </div>
                    ))}
                  </div>
                  <div>
                    <label className="text-sm font-bold text-slate-700 uppercase tracking-wide block mb-2">Expected Standard Deviation</label>
                    <input type="number" className="w-full p-4 border border-slate-200 rounded-xl bg-slate-50/50" placeholder="e.g. 8.5" value={sd} onChange={(e) => setSd(e.target.value)} />
                  </div>
                </div>
              )}
            </div>
          )}

          <details className="mt-6 p-5 border border-slate-200 bg-slate-50/30 rounded-2xl cursor-pointer">
            <summary className="font-bold text-slate-700 text-sm">Advanced Clinical Settings (Dental Clustering & Attrition)</summary>
            <div className="mt-4 flex flex-col gap-6">
              <div>
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wide block mb-2">Clustering: Are you measuring multiple teeth per patient?</label>
                <select className="w-full p-3 border border-slate-200 rounded-xl bg-white text-xs" value={deffVal} onChange={(e) => setDeffVal(parseFloat(e.target.value))}>
                  <option value={1.0}>No (Patient level analysis is independent)</option>
                  <option value={1.5}>Yes (Standard Dental Design Effect = 1.5)</option>
                  <option value={2.0}>Yes (High clustering effect = 2.0)</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wide block mb-2">Finite Population Target (Optional)</label>
                <input type="number" className="w-full p-3 border border-slate-200 rounded-xl bg-white text-xs" placeholder="Leave blank for infinite" value={population} onChange={(e) => setPopulation(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wide block mb-2">Expected Survey Return Rate: {responseRate}%</label>
                <input type="range" className="w-full" min={50} max={100} step={5} value={responseRate} onChange={(e) => setResponseRate(parseInt(e.target.value))} />
              </div>
            </div>
          </details>

          {errorMsg && <div className="text-red-600 font-bold text-xs mt-4">{errorMsg}</div>}

          <div className="flex justify-between mt-8 border-t border-slate-100 pt-6">
            <button className="px-8 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold" onClick={() => setCurrentStep(3)}>⬅ Back</button>
            <button className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-lg shadow-blue-600/20" onClick={calculateFinalSize} disabled={isCalculating}>
              {isCalculating ? 'Computing Models...' : 'Calculate Sample Size ➔'}
            </button>
          </div>
        </div>
      )}

      {/* STEP 5: Interactive Dashboard & Results */}
      {currentStep === 5 && results && (
        <div className="p-8 bg-slate-50/50 animate-fade-in">
          
          {/* THE EXPORTABLE SCREENSHOT DASHBOARD */}
          <div id="exportable-dashboard" className="p-8 bg-white border border-slate-200/60 rounded-3xl shadow-sm mb-6">
            
            {/* Rigor Meter Badge */}
            <div className="mb-6 flex flex-col items-center">
              <div className={`w-full p-5 rounded-2xl border-2 flex flex-col md:flex-row items-center justify-between gap-4 ${rigorScore.color}`}>
                <div className="flex items-center gap-4">
                  <div className="text-4xl font-black">{rigorScore.score}</div>
                  <div>
                    <h4 className="font-extrabold text-slate-900 leading-tight">Scientific Rigor Grade</h4>
                    <p className="text-xs text-slate-600 mt-1">{rigorScore.label}</p>
                  </div>
                </div>
                <div className="text-xs max-w-lg leading-relaxed text-slate-600 text-center md:text-left">
                  {rigorScore.advice}
                </div>
              </div>
            </div>

            <div className="text-center border-b border-slate-100 pb-8 mb-8">
              <h3 className="text-slate-400 font-extrabold text-xs tracking-widest uppercase mb-1">Methodological Sample Size Target</h3>
              <div className="result-number text-8xl font-black text-blue-600 leading-none my-3">{results.final_n_per_group}</div>
              <div className="font-extrabold text-slate-800 text-xl capitalize">{numGroups === 1 ? 'total samples' : 'samples per group'}</div>
              <p className="text-sm text-slate-500 mt-2">Total target study distribution size: <strong className="text-slate-800">{results.total_n}</strong></p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
              {/* Waterfall Adjustments */}
              <div className="waterfall p-6 bg-slate-50 border border-slate-100 rounded-2xl flex flex-col gap-4">
                <div className="font-bold text-slate-800 text-md border-b border-slate-200/50 pb-2">Sample Size Adjustments</div>
                
                <div className="wf-row flex justify-between items-center text-xs font-semibold">
                  <span>Base Statistical Target</span>
                  <span className="text-blue-600">{results.baseline_n}</span>
                </div>
                {results.n_fact > 0 && (
                  <div className="wf-row flex justify-between items-center text-xs font-semibold">
                    <span>Interaction Multiplier</span>
                    <span className="text-purple-600">+{results.n_fact}</span>
                  </div>
                )}
                {results.n_deff > 0 && (
                  <div className="wf-row flex justify-between items-center text-xs font-semibold">
                    <span>Dental Clustering (DEFF)</span>
                    <span className="text-amber-500">+{results.n_deff}</span>
                  </div>
                )}
                {results.n_fpc > 0 && (
                  <div className="wf-row flex justify-between items-center text-xs font-semibold">
                    <span>Finite Population Constraint</span>
                    <span className="text-emerald-600">-{results.n_fpc}</span>
                  </div>
                )}
                {results.n_att > 0 && (
                  <div className="wf-row flex justify-between items-center text-xs font-semibold">
                    <span>Non-Response Attrition</span>
                    <span className="text-red-500">+{results.n_att}</span>
                  </div>
                )}
              </div>

              {/* Overlap Bell Curve Canvas */}
              {numGroups > 1 && (
                <div className="viz-box p-6 bg-slate-50 border border-slate-100 rounded-2xl flex flex-col items-center">
                  <div className="font-bold text-slate-800 text-md mb-1">Statistical Variance Overlap</div>
                  <canvas ref={canvasRef} className="w-full max-h-40" />
                  <div className="text-xs font-bold text-blue-600 bg-blue-50/50 px-3 py-1.5 rounded-full mt-4">Exact Omnibus Probability Distribution</div>
                </div>
              )}
            </div>

            <h4 className="font-bold text-sm text-slate-800 mb-2">Manuscript Justification Paragraph</h4>
            <div className="report-box p-6 border border-slate-300 bg-slate-50 rounded-2xl text-slate-800 text-sm leading-relaxed font-sans">{results.academic_report}</div>
          </div>

          {/* Sensitivity Slider Analysis (Outside of the screenshot element) */}
          {numGroups > 1 && (
            <div className="power-box p-6 bg-white border border-slate-200 rounded-3xl mb-6 shadow-sm">
              <div className="power-header flex justify-between items-end mb-4">
                <div>
                  <h4 className="font-bold text-slate-800 text-md">Sensitivity / Statistical Power Curve Simulation</h4>
                  <p className="text-xs text-slate-500 mt-1">Simulated power based on actual participant count of: <strong className="text-slate-800">{simulatedN} per group</strong></p>
                </div>
                <div className="power-gauge text-4xl font-extrabold" style={{ color: simulatedPower >= 80 ? '#10b981' : simulatedPower >= 60 ? '#f59e0b' : '#ef4444' }}>{simulatedPower.toFixed(1)}%</div>
              </div>
              <input type="range" className="clinical-slider w-full" min={5} max={results.final_n_per_group * 2} value={simulatedN} onChange={(e) => updatePowerGauge(parseInt(e.target.value))} />
            </div>
          )}

          <div className="nav-buttons flex justify-between border-t border-slate-200/50 pt-6">
            <button className="px-8 py-3 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl font-bold" onClick={() => setCurrentStep(4)}>⬅ Adjust Values</button>
            <button className="px-8 py-3 bg-slate-900 text-white hover:bg-slate-800 rounded-xl font-bold shadow-lg flex items-center gap-2" id="copyBtn" onClick={copyDashboardImage}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"/></svg>
              Copy for Word/PPT
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
