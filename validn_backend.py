import math
from typing import List, Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import numpy as np
from scipy.stats import f, ncf, chi2, ncx2, norm

app = FastAPI(
    title="ValidN Biostatistical Engine",
    description="Exact non-central distribution calculations for clinical sample size planning.",
    version="1.1.0"
)

# Enable CORS for Next.js frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your exact Next.js domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- REQUEST / RESPONSE SCHEMAS ---

class CalculationRequest(BaseModel):
    primaryOutcomeName: str = Field(..., description="Name of the primary outcome (dependent variable)")
    indepVars: int = Field(..., description="Number of independent variables (1 or 2)")
    factorialGoal: str = Field("main", description="Either 'main' or 'interaction'")
    numGroups: int = Field(..., description="Number of treatment groups (1 to 5+)")
    outcomesCount: int = Field(..., description="Number of primary outcomes tracked")
    dataType: str = Field(..., description="Outcome data type: 'continuous', 'binary', or 'ordinal'")
    dataSource: str = Field(..., description="Source of expected values: 'paper' or 'none'")
    groupNames: List[str] = Field(..., description="Names of the treatment groups")
    means: Optional[List[float]] = None
    proportions: Optional[List[float]] = None
    sd: Optional[float] = None
    cohenEffect: Optional[float] = None
    deffVal: float = Field(1.0, description="Design Effect for dental clustering")
    population: Optional[int] = None
    responseRate: float = Field(0.9, description="Expected response rate (0.5 to 1.0)")
    paperDoi: Optional[str] = None
    prevProp: Optional[float] = None
    ciWidth: Optional[float] = None

class CalculationResponse(BaseModel):
    baseline_n: int
    final_n_per_group: int
    total_n: int
    n_fact: int
    n_deff: int
    n_fpc: int
    n_att: int
    calc_delta: float
    calc_sd: float
    effect_size: float
    academic_report: str
    pairwise_comps: int
    post_hoc_alpha: float
    omnibus_alpha: float

# --- EXACT MATHEMATICAL HELPER FUNCTIONS ---

def exact_chi_square_n(alpha: float, power: float, df: int, effect_size_w: float) -> int:
    """
    Computes exact sample size for an omnibus Chi-Square test using Scipy's non-central chi2.
    Avoids Patnaik/Wilson-Hilferty approximation errors.
    Returns total required N (N_total).
    """
    if effect_size_w <= 0:
        return 5
    
    # Find critical value on central chi2 distribution
    chi2_crit = chi2.ppf(1 - alpha, df)
    
    # Binary search for N
    n_low, n_high = 2, 100000
    while n_low < n_high:
        n_mid = (n_low + n_high) // 2
        # Non-centrality parameter lambda = N * w^2
        nc_parameter = n_mid * (effect_size_w ** 2)
        
        # Power = P(Non-Central Chi2 > Critical Value)
        computed_power = 1 - ncx2.cdf(chi2_crit, df, nc_parameter)
        
        if computed_power >= power:
            n_high = n_mid
        else:
            n_low = n_mid + 1
            
    return n_low

def exact_anova_f_n(alpha: float, power: float, groups: int, effect_size_f: float) -> int:
    """
    Computes exact sample size for a one-way ANOVA F-Test using Scipy's non-central F distribution.
    Matches G*Power precisely across all degrees of freedom.
    Returns required N per group.
    """
    if effect_size_f <= 0:
        return 5
    
    df1 = groups - 1
    
    # Binary search for N per group
    n_low, n_high = 2, 50000
    while n_low < n_high:
        n_mid = (n_low + n_high) // 2
        n_total = n_mid * groups
        df2 = n_total - groups
        
        if df2 <= 0:
            n_low = n_mid + 1
            continue
            
        # Critical F on central F distribution
        f_crit = f.ppf(1 - alpha, df1, df2)
        
        # Non-centrality parameter lambda = N_total * f^2
        nc_parameter = n_total * (effect_size_f ** 2)
        
        # Power = P(Non-Central F > Critical F)
        computed_power = 1 - ncf.cdf(f_crit, df1, df2, nc_parameter)
        
        if computed_power >= power:
            n_high = n_mid
        else:
            n_low = n_mid + 1
            
    return n_low

# --- MAIN ENGINE ROUTE ---

@app.post("/api/calculate", response_model=CalculationResponse)
def calculate_sample_size(data: CalculationRequest):
    try:
        base_alpha = 0.05
        target_power = 0.80
        doi_citation = f" (DOI: {data.paperDoi})" if data.paperDoi else ""
        
        # Step 1: Handle Descriptive Designs (1 Group Survey)
        if data.numGroups == 1:
            if data.prevProp is None or data.ciWidth is None:
                raise HTTPException(status_code=400, detail="Prevalence and Margin of Error are required for 1 Group.")
            
            p = data.prevProp / 100.0
            d = data.ciWidth
            z_alpha = norm.ppf(1 - base_alpha / 2)
            
            # Cochran's (1977) formula
            baseline_n = math.ceil((z_alpha ** 2 * p * (1 - p)) / (d ** 2))
            
            report = (
                f"The sample size was calculated to evaluate the descriptive prevalence of {data.primaryOutcomeName} "
                f"in {data.groupNames[0]}. To achieve a ±{d * 100:.0f}% margin of error (precision) with 95% confidence, "
                f"assuming an expected prevalence of {p * 100:.1f}%{doi_citation} (Cochran, 1977), "
                f"the baseline calculation required {baseline_n} total samples."
            )
            
            # Pack response parameters cleanly using snake_case conventions
            calc_delta, calc_sd, effect_size = 0.0, 1.0, 0.0
            pairwise_comps, post_hoc_alpha, omnibus_alpha = 1, base_alpha, base_alpha

        # Step 2: Handle Comparative Designs (2+ Groups Hypothesis Testing)
        else:
            pairwise_comps = int((data.numGroups * (data.numGroups - 1)) / 2) if data.numGroups > 2 else 1
            omnibus_alpha = base_alpha / data.outcomesCount
            post_hoc_alpha = base_alpha / (data.outcomesCount * pairwise_comps)
            
            z_beta = abs(norm.ppf(1.0 - target_power))
            z_post_hoc = abs(norm.ppf(1.0 - (post_hoc_alpha / 2)))
            
            # Sub-path A: Cohen's Standardized Effect Size Bypass (No literature)
            if data.dataSource == "none":
                if data.cohenEffect is None:
                    raise HTTPException(status_code=400, detail="Cohen's effect size option is missing.")
                
                eff = data.cohenEffect
                calc_sd, calc_delta = 1.0, eff
                
                if data.numGroups > 2:
                    if data.dataType == "binary":
                        # Map Cohen's h (0.8, 0.5, 0.2) to Cohen's w for Chi-Square (0.5, 0.3, 0.1)
                        w = 0.5 if eff == 0.8 else (0.3 if eff == 0.5 else 0.1)
                        effect_size = w
                        # Exact Chi-Square df = k - 1. We divide the total omnibus N by numGroups to get per-group N.
                        n_omnibus = math.ceil(exact_chi_square_n(omnibus_alpha, target_power, data.numGroups - 1, w) / data.numGroups)
                    else:
                        # Map Cohen's d to ANOVA f (f = d/2)
                        f_effect = eff / 2.0
                        effect_size = f_effect
                        n_omnibus = exact_anova_f_n(omnibus_alpha, target_power, data.numGroups, f_effect)
                        
                    # Dual-Protection: Ensure post-hoc pairwise contrasts are also fully powered
                    n_pairwise = math.ceil((2 * (z_post_hoc + z_beta) ** 2) / (eff ** 2))
                    n_per_group = max(n_pairwise, n_omnibus)
                else:
                    n_per_group = math.ceil((2 * (z_post_hoc + z_beta) ** 2) / (eff ** 2))
                    effect_size = eff
                
                size_text = "large" if eff == 0.8 else ("moderate" if eff == 0.5 else "small")
                report = (
                    f"As pilot data was unavailable, calculations utilized Cohen's standardized effect size guidelines (Cohen, 1988). "
                    f"The study was powered to detect a clinically {size_text} difference across {data.numGroups} group(s), "
                    f"actively ensuring adequate statistical power for both omnibus and pairwise evaluations."
                )

            # Sub-path B: Raw Literature/Pilot Data Extraction (Highest rigor)
            else:
                if data.dataType == "binary":
                    if not data.proportions or len(data.proportions) != data.numGroups:
                        raise HTTPException(status_code=400, detail="Proportions must match group count.")
                    
                    props = [p / 100.0 for p in data.proportions]
                    p_max, p_min = max(props), min(props)
                    
                    calc_delta = abs(p_max - p_min)
                    calc_sd = math.sqrt((p_max * (1 - p_max) + p_min * (1 - p_min)) / 2.0)
                    
                    # Pairwise Post-Hoc Base
                    n_pairwise = math.ceil(
                        ((z_post_hoc + z_beta) ** 2 * (p_max * (1 - p_max) + p_min * (1 - p_min))) / (calc_delta ** 2)
                    )
                    
                    if data.numGroups > 2:
                        grand_p = sum(props) / len(props)
                        # Exact Cohen's w calculation across all groups
                        w_sum = sum([((p - grand_p) ** 2) / (grand_p * (1.0 - grand_p)) for p in props])
                        w = math.sqrt((1.0 / data.numGroups) * w_sum)
                        effect_size = w
                        
                        # Exact Chi-Square df = k - 1. We divide the total omnibus N by numGroups to get per-group N.
                        n_omnibus = math.ceil(exact_chi_square_n(omnibus_alpha, target_power, data.numGroups - 1, w) / data.numGroups)
                        n_per_group = max(n_pairwise, n_omnibus)
                        
                        report = (
                            f"Sample size was established utilizing an omnibus Chi-Square framework. Based on the provided proportions{doi_citation}, "
                            f"Cohen's w effect size was calculated at {w:.3f}. The mathematical model dynamically selected the maximum of the "
                            f"omnibus test and pairwise comparisons to guarantee structural power."
                        )
                    else:
                        n_per_group = n_pairwise
                        effect_size = calc_delta / calc_sd
                        report = f"Sample size was calculated based on expected outcome proportions between {p_max * 100:.1f}% and {p_min * 100:.1f}%{doi_citation}."

                else: # Continuous or Ordinal
                    if not data.means or len(data.means) != data.numGroups or data.sd is None:
                        raise HTTPException(status_code=400, detail="Means and Standard Deviation are required.")
                    
                    means = data.means
                    sd = data.sd
                    m_max, m_min = max(means), min(means)
                    calc_delta = abs(m_max - m_min)
                    calc_sd = sd
                    
                    # Pairwise Power using z_post_hoc (corrected from zAlpha)
                    n_pairwise = math.ceil((2 * sd ** 2 * (z_post_hoc + z_beta) ** 2) / (calc_delta ** 2))
                    
                    if data.numGroups > 2:
                        grand_mean = sum(means) / len(means)
                        var_means = sum([(m - grand_mean) ** 2 for m in means]) / len(means)
                        f_effect = math.sqrt(var_means / (sd ** 2))
                        effect_size = f_effect
                        
                        n_omnibus = exact_anova_f_n(omnibus_alpha, target_power, data.numGroups, f_effect)
                        n_per_group = max(n_pairwise, n_omnibus)
                        
                        report = (
                            f"Sample size was established utilizing an omnibus analysis of variance framework. Based on the provided means "
                            f"and standard deviation of {sd}{doi_citation}, Cohen's f effect size was calculated at {f_effect:.3f}. "
                            f"The dual-protection model was maxed to ensure power for both global tests and pairwise contrasts."
                        )
                    else:
                        effect_size = calc_delta / sd
                        n_per_group = n_pairwise
                        report = f"Based on expected outcome means of {m_max} and {m_min} with a standard deviation of {sd}{doi_citation}."
                    
                    # Ordinal Non-Parametric Adjustment (Lehmann, 1975)
                    if data.dataType == "ordinal":
                        n_per_group = math.ceil(n_per_group / 0.955)
                        report += (
                            "As the outcome utilizes an ordinal scale, an Asymptotic Relative Efficiency (ARE) adjustment "
                            "(~4.7% sample inflation) was mathematically applied to preserve non-parametric statistical power "
                            "for subsequent Kruskal-Wallis or Mann-Whitney evaluations (Lehmann, 1975). "
                        )

            # Standard statistical framework justification appendage
            stat_justification = f"To achieve 80% statistical power with a 95% global confidence level"
            if data.outcomesCount > 1 or data.numGroups > 2:
                stat_justification += (
                    f", a stringent family-wise Bonferroni correction was applied for {data.outcomesCount} co-primary outcome(s) "
                    f"and {pairwise_comps} pairwise comparison(s) (adjusted post-hoc alpha = {post_hoc_alpha:.4f}) to strictly control "
                    f"Type I error inflation (Julious, 2004)"
                )
            else:
                stat_justification += " (alpha = 0.05)"
                
            report += f"{stat_justification}, requiring a baseline calculation of {n_per_group} samples per group. "

        # --- STEP 3: APPLY SEQUENTIAL CLINICAL LOGISTICS MULTIPLIERS ---
        baseline_n = n_per_group
        current_n = baseline_n
        
        # 1. Interaction Multiplier (Brookes et al., 2001)
        n_fact = 0
        if data.indepVars > 1:
            if data.factorialGoal == "interaction":
                n_fact = current_n * 3
                current_n += n_fact
                report += (
                    f"Because the study evaluates multiple independent factors simultaneously, the sample size was "
                    f"multiplied by 4 to preserve power to detect the omnibus interaction effect (Brookes et al., 2001). "
                )
            else:
                report += "The calculation was powered strictly for main effects; testing for interaction effects is exploratory. "

        # 2. Design Effect (Clustering)
        n_deff = 0
        if data.deffVal > 1.0:
            n_deff = math.ceil(current_n * data.deffVal) - current_n
            current_n += n_deff
            report += f"A Design Effect multiplier of {data.deffVal} was applied to account for intra-cluster correlation. "

        # 3. Finite Population Correction (Cochran, 1977)
        n_fpc = 0
        if data.population and data.population > 0:
            corrected = math.ceil((current_n * data.population) / (current_n + data.population - 1))
            n_fpc = current_n - corrected
            current_n = corrected
            report += f"A finite population correction was applied assuming a total accessible census of {data.population}. "

        # 4. Attrition / Non-Response Inflation
        n_att = 0
        if data.responseRate < 1.0:
            final_inflated = math.ceil(current_n / data.responseRate)
            n_att = final_inflated - current_n
            current_n = final_inflated
            report += f"Finally, to buffer against an expected {((1.0 - data.responseRate) * 100):.0f}% clinical attrition rate, the final target was inflated. "

        total_n = current_n if data.numGroups == 1 else current_n * data.numGroups
        report += f"Therefore, the final target sample size for this study is {total_n} " + (f"participants." if data.numGroups == 1 else f"({current_n} per group).")

        return CalculationResponse(
            baseline_n=baseline_n,
            final_n_per_group=current_n,
            total_n=total_n,
            n_fact=n_fact,
            n_deff=n_deff,
            n_fpc=n_fpc,
            n_att=n_att,
            calc_delta=calc_delta,
            calc_sd=calc_sd,
            effect_size=effect_size,
            academic_report=report,
            pairwise_comps=pairwise_comps,
            post_hoc_alpha=post_hoc_alpha if data.numGroups > 1 else base_alpha,
            omnibus_alpha=omnibus_alpha if data.numGroups > 1 else base_alpha
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
