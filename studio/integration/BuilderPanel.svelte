<script lang="ts">
  // In the *native* OpenPlan3D editor: one editable project model, no iframe or file import.
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import { base } from '$app/paths';
  import { currentProject, loadProject, viewMode } from '$lib/stores/project';
  import { localStore } from '$lib/services/datastore';
  import { autoSave, markClean } from '$lib/stores/saveStatus';
  import { readProject } from '$lib/utils/projectValidation';
  import { exportToOpenPlan } from '$lib/builder/openplan-export.js';
  import { reviewNativePlan, wallSignature } from '$lib/builder/native-check.js';

  type SiteInfo = { id: string; name: string; target?: { unitsPerFloor?: number } };
  type Candidate = {
    status: string; rooms?: Array<Record<string, unknown>>;
    variant?: string; reason?: string; not_checked?: string[];
  };
  type Solution = {
    schema_version: string; engine: string; site_id: string;
    candidates: Candidate[]; site?: { unsupported?: string };
  };
  let expanded = $state(true);
  let busy = $state(false);
  let error = $state('');
  let statusText = $state('');
  let sites = $state<SiteInfo[]>([]);
  let siteId = $state('A');
  let variantIndex = $state(0);
  let solutions = $state<Solution | null>(null);
  let checking = $state(false);
  const review = $derived(reviewNativePlan($currentProject));
  const candidates = $derived(solutions?.candidates?.filter(
    c => c.status === 'FEASIBLE' || c.status === 'OPTIMAL'
  ) ?? []);
  // The main editor is at /Builder_builder-/studio/editor; Builder data is a sibling.
  const builderRoot = base.replace(/\/editor$/, '');

  async function loadSolutions(){
    busy = true;
    error = '';
    solutions = null;
    variantIndex = 0;
    try{
      if (!/^[A-E]$/.test(siteId)) throw new Error('شناسه زمین ناشناخته است.');
      const response = await fetch(builderRoot + '/solutions/' + siteId + '.json', {cache:'no-store'});
      if (!response.ok) throw new Error('خروجی حل‌گر برای این زمین پیدا نشد.');
      const payload: Solution = await response.json();
      if(payload.schema_version !== 'cp-sat-v1' || payload.engine !== 'Google OR-Tools CP-SAT' || payload.site_id !== siteId)
        throw new Error('داده حل‌گر قابل اعتماد نیست.');
      solutions = payload;
      statusText = candidates.length ? 'پاسخ‌های محاسبه‌شده آماده‌اند.' : 'برای این زمین هنوز موتور قابل استفاده نداریم.';
    }catch(err){
      error = err instanceof Error ? err.message : 'خطا در بازیابی جواب حل‌گر';
    }finally{busy = false;}
  }

  async function createScheme(){
    if(busy)return;
    const candidate = candidates[variantIndex];
    if(!candidate?.rooms?.length){error='برای این زمین پاسخی موجود نیست؛ پلان ساختگی تولید نمی‌شود.';return;}
    const site = sites.find(s=>s.id===siteId);
    if(!site){error='زمین انتخاب‌شده معتبر نیست.';return;}
    busy=true;error='';statusText='';
    try{
      // Make native OpenPlan3D geometry from the actual CI-computed CP-SAT solution.
      const exported = exportToOpenPlan({site,items:candidate.rooms});
      const parsed = readProject(exported);
      parsed.name = 'راماچ · ' + site.name + ' · گزینه ' + (variantIndex+1);
      const enriched = parsed as typeof parsed & {builderEvidence?: {
        siteId:string; variant:string; solver:string; status:string;
        wallBaseline:string; pendingChecks:string[];
      }};
      enriched.builderEvidence = {
        siteId, variant:candidate.variant||String(variantIndex+1),
        solver:'Google OR-Tools CP-SAT (precomputed)',
        status:candidate.status,
        wallBaseline:wallSignature(parsed.floors[0]),
        pendingChecks:candidate.not_checked||[]
      };
      // Preserve the current editable project before switching.
      if(get(currentProject)) await autoSave();
      // Always create a new native document, never overwrite the old scheme.
      const saved = await localStore.saveCopy(enriched, 'طرح جدید');
      loadProject(saved);
      markClean();
      viewMode.set('2d');
      statusText='طرح در همین ویرایشگر ساخته و ذخیره شد؛ دیوارها و درها قابل ویرایش‌اند.';
    }catch(err){
      error = err instanceof Error ? err.message : 'ساخت پروژه جدید ناموفق بود.';
    }finally{busy=false;}
  }

  onMount(async()=>{
    try{
      const response=await fetch(base.replace(/\/studio\/editor$/, '')+'/data/scenarios.json');
      if(!response.ok)throw new Error('بانک زمین بارگذاری نشد.');
      const data=await response.json();
      sites=Array.isArray(data)?data.map(s=>({id:s.id,name:s.name,target:s.target})):[];
      if(!sites.some(s=>s.id===siteId)) siteId=sites[0]?.id||'A';
      await loadSolutions();
    }catch(err){error=err instanceof Error?err.message:'خطا در داده زمین';}
  });
</script>

<div dir="rtl" class="relative z-30 border-b border-slate-700 bg-slate-900 text-slate-100 text-[13px]">
  <div class="flex flex-wrap items-center gap-2 px-3 py-2">
    <strong class="text-teal-300 whitespace-nowrap">راماچ · Builder</strong>
    <button
      class="rounded border border-slate-600 px-2 py-1 hover:bg-slate-700"
      onclick={() => expanded = !expanded}
      aria-expanded={expanded}
      aria-label="باز و بسته کردن پنل جانمایی"
    >{expanded ? 'بستن تنظیمات' : 'طرح پیشنهادی'}</button>
    {#if expanded}
      <label class="whitespace-nowrap">زمین
        <select class="ml-1 bg-slate-800 border border-slate-500 rounded p-1" bind:value={siteId} onchange={loadSolutions} disabled={busy}>
          {#each sites as site}
            <option value={site.id}>{site.name}</option>
          {/each}
        </select>
      </label>
      <label class="whitespace-nowrap">گزینه
        <select class="ml-1 bg-slate-800 border border-slate-500 rounded p-1" bind:value={variantIndex} disabled={busy||candidates.length===0}>
          {#each candidates as c,i}
            <option value={i}>طرح {i+1} · {c.status}</option>
          {/each}
        </select>
      </label>
      <button
        class="rounded bg-teal-200 text-slate-900 px-3 py-1.5 font-bold disabled:opacity-40"
        disabled={busy||candidates.length===0}
        onclick={createScheme}
      >{busy?'در حال پردازش':'ایجاد طرح در همین ویرایشگر'}</button>
      <span class="text-slate-400 text-[12px]">ویرایش دیوار، در و پنجره در همین صفحه انجام می‌شود</span>
    {/if}
    <span class="mr-auto text-amber-300 text-[12px]">مفهومی؛ بدون تأیید سازه و مقررات</span>
  </div>
  {#if error}
    <p role="alert" class="m-0 px-3 pb-2 text-red-300">{error}</p>
  {:else if statusText && expanded}
    <p role="status" class="m-0 px-3 pb-2 text-slate-400">{statusText}</p>
  {/if}
  {#if expanded && $currentProject}
    <div class="flex flex-wrap items-center gap-2 border-t border-slate-700/70 px-3 py-2 text-[12px]">
      <strong class="text-slate-200">کنترل همین پلان:</strong>
      {#if review.changed}
        <span class="text-amber-300">دیوارها نسبت به خروجی Solver تغییر کرده‌اند</span>
      {/if}
      <span class="text-slate-400">{review.warnings} هشدار عملکردی</span>
      <button class="border border-slate-600 rounded px-2 py-1 hover:bg-slate-700" onclick={() => checking=!checking}>
        {checking?'بستن جزئیات':'جزئیات کنترل'}
      </button>
      {#if checking}
        <div class="basis-full grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2 pt-1">
          {#each review.messages as issue}
            <div class="border border-slate-600 rounded p-2 text-slate-300">{issue.text}</div>
          {/each}
        </div>
      {/if}
    </div>
  {/if}
</div>
