import { useState, type FormEvent } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { hasText, Icon, isPlaceholder, Section, SocialIcon, T } from '../ui';
import { rv } from '../../lib/motion';

const DEFAULT_FIELDS = [
  { name: 'name', label: 'Your name', type: 'text', required: true, autocomplete: 'name' },
  { name: 'phone', label: 'Phone number', type: 'tel', required: true, autocomplete: 'tel' },
  { name: 'email', label: 'Email (optional)', type: 'email', required: false, autocomplete: 'email' },
  { name: 'message', label: 'How can we help?', type: 'textarea', required: true },
];

const digits = (s: string) => s.replace(/[^\d+]/g, '');

/**
 * Demo enquiry form. It validates input and shows a clearly labelled preview confirmation.
 * It never sends data anywhere — this is a sales prototype, not the business's live website.
 */
function DemoForm({ form }: { form: any }) {
  const fields: any[] = Array.isArray(form?.fields) && form.fields.length ? form.fields : DEFAULT_FIELDS;
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sent, setSent] = useState(false);

  function validate(fd: FormData) {
    const e: Record<string, string> = {};
    for (const f of fields) {
      const v = String(fd.get(f.name) || '').trim();
      if (f.required && !v) e[f.name] = `Please enter ${String(f.label).toLowerCase().replace(/\s*\(optional\)/, '')}.`;
      else if (v && f.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) e[f.name] = 'Please enter a valid email address.';
      else if (v && f.type === 'tel' && digits(v).replace('+', '').length < 7) e[f.name] = 'Please enter a valid phone number.';
    }
    return e;
  }

  function onSubmit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const e = validate(new FormData(ev.currentTarget));
    setErrors(e);
    if (Object.keys(e).length === 0) {
      setSent(true);
      ev.currentTarget.reset();
    } else {
      const first = ev.currentTarget.querySelector<HTMLElement>(`[name="${Object.keys(e)[0]}"]`);
      first?.focus();
    }
  }

  if (sent) {
    return (
      <div className="mobile-menu-panel rounded-brand border border-primary/40 bg-accent p-8 text-center" role="status" data-demo-success>
        <CheckCircle2 className="mx-auto h-12 w-12 text-primary" aria-hidden="true" />
        <p className="mt-4 text-xl font-semibold">Thanks — this is how your enquiry confirmation would look.</p>
        <p className="mt-2 text-muted">Preview only: this demo form does not send your details anywhere.</p>
        <button type="button" onClick={() => setSent(false)} className="mt-6 min-h-11 rounded-brand border border-border px-5 py-2 font-semibold hover:bg-bg">Send another</button>
      </div>
    );
  }

  return (
    <form noValidate onSubmit={onSubmit} className="space-y-5 rounded-brand border border-border bg-bg p-6 shadow-sm md:p-8" data-demo-form aria-label="Enquiry form (demo)">
      {fields.map((f) => {
        const id = `f-${f.name}`;
        const err = errors[f.name];
        const common = {
          id,
          name: f.name,
          required: Boolean(f.required),
          'aria-invalid': err ? true : undefined,
          'aria-describedby': err ? `${id}-err` : undefined,
          autoComplete: f.autocomplete,
          className: `w-full rounded-brand border bg-bg px-4 py-3 text-base outline-none transition duration-300 focus:border-primary focus:shadow-[0_0_0_4px_color-mix(in_srgb,var(--color-primary)_18%,transparent)] ${err ? 'border-red-500' : 'border-border'}`,
        };
        return (
          <div key={f.name}>
            <label htmlFor={id} className="mb-2 block text-sm font-semibold">{f.label}{f.required && <span className="text-primary"> *</span>}</label>
            {f.type === 'textarea' ? (
              <textarea {...common} rows={4} />
            ) : f.type === 'select' ? (
              <select {...common} defaultValue="">
                <option value="" disabled>Choose…</option>
                {(f.options || []).map((o: string) => <option key={o}>{o}</option>)}
              </select>
            ) : (
              <input {...common} type={['email', 'tel', 'date', 'number'].includes(f.type) ? f.type : 'text'} />
            )}
            {err && <p id={`${id}-err`} className="mt-1.5 text-sm text-red-600" data-field-error>{err}</p>}
          </div>
        );
      })}
      <button type="submit" className="btn-shine min-h-12 w-full rounded-brand bg-primary px-6 py-3 font-semibold text-primary-contrast transition hover:brightness-110">
        {form?.submit_label || 'Send enquiry'}
      </button>
      <p className="text-center text-xs text-muted">Demo form — nothing is sent from this preview.</p>
    </form>
  );
}

export function Contact({ s }: { s: any }) {
  const info = s.info || {};
  const hours: any[] = Array.isArray(info.hours) ? info.hours : [];
  const rows: { icon: string; label: string; value: string; href?: string }[] = [];
  if (hasText(info.phone)) rows.push({ icon: 'phone', label: 'Phone', value: info.phone, href: isPlaceholder(info.phone) ? undefined : `tel:${digits(info.phone)}` });
  if (hasText(info.whatsapp)) rows.push({ icon: 'message', label: 'WhatsApp', value: info.whatsapp, href: isPlaceholder(info.whatsapp) ? undefined : `https://wa.me/${digits(info.whatsapp).replace('+', '')}` });
  if (hasText(info.email)) rows.push({ icon: 'mail', label: 'Email', value: info.email, href: isPlaceholder(info.email) ? undefined : `mailto:${info.email}` });
  if (hasText(info.address)) rows.push({ icon: 'map-pin', label: 'Address', value: info.address });
  const mapQuery = hasText(s.map_query) && !isPlaceholder(s.map_query) ? s.map_query : null;
  const social: any[] = (s.social || []).filter((x: any) => /^https:\/\//.test(x.url || ''));

  return (
    <Section id={s.id || 'contact'} eyebrow={s.eyebrow} heading={s.heading} intro={s.intro} tone={s.tone ?? 'surface'}>
      <div className="grid gap-10 lg:grid-cols-5 lg:gap-14">
        <div className="space-y-6 lg:col-span-2">
          {rows.map((r, i) => (
            <div key={i} {...rv(i)} className="group flex gap-4">
              <span className="flex h-12 w-12 shrink-0 transition-transform duration-500 group-hover:-rotate-6 group-hover:scale-110 items-center justify-center rounded-brand bg-bg text-primary shadow-sm"><Icon name={r.icon} className="h-5 w-5" /></span>
              <div>
                <p className="text-sm font-semibold uppercase tracking-wider text-muted">{r.label}</p>
                {r.href ? (
                  <a href={r.href} className="text-lg font-medium hover:text-primary" {...(r.href.startsWith('https') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}><T>{r.value}</T></a>
                ) : (
                  <p className="text-lg font-medium"><T>{r.value}</T></p>
                )}
              </div>
            </div>
          ))}
          {hours.length > 0 && (
            <div {...rv(rows.length)} className="flex gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-brand bg-bg text-primary shadow-sm"><Icon name="clock" className="h-5 w-5" /></span>
              <div className="flex-1">
                <p className="text-sm font-semibold uppercase tracking-wider text-muted">Opening hours</p>
                <dl className="mt-1 space-y-1">
                  {hours.map((h, i) => (
                    <div key={i} className="flex justify-between gap-4"><dt><T>{h.days}</T></dt><dd className="text-muted"><T>{h.time}</T></dd></div>
                  ))}
                </dl>
              </div>
            </div>
          )}
          {social.length > 0 && (
            <div className="flex gap-3 pt-2">
              {social.map((x, i) => (
                <a key={i} href={x.url} target="_blank" rel="noopener noreferrer" aria-label={x.platform} className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-bg hover:text-primary"><SocialIcon platform={x.platform} /></a>
              ))}
            </div>
          )}
          {mapQuery && (
            <iframe
              title={`Map showing ${mapQuery}`}
              src={`https://www.google.com/maps?q=${encodeURIComponent(mapQuery)}&output=embed`}
              className="h-64 w-full rounded-brand border border-border"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          )}
        </div>
        <div {...rv(1)} className="lg:col-span-3">{s.show_form === false ? null : <DemoForm form={s.form} />}</div>
      </div>
    </Section>
  );
}
