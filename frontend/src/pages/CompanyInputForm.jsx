import { useState } from "react";
import Button from "../ui/Button";
import { Field, TextInput, TextArea } from "../ui/Input";

// Hardcoded fallback for production
const PROD_API = 'https://web-production-9ceeb.up.railway.app';
const API_BASE = import.meta.env.VITE_API_BASE || (import.meta.env.PROD ? PROD_API : "http://localhost:4000");

async function uploadCompanyImage(companyId, file, companyName) {
  const formData = new FormData();
  formData.append("image", file);
  if (companyName) {
    formData.append("caption", `${companyName} 대표 이미지`);
  }
  const res = await fetch(`${API_BASE}/companies/${companyId}/images`, {
    method: "POST",
    body: formData,
  });
  let data = {};
  try {
    data = await res.json();
  } catch (_) { }
  if (!res.ok) {
    throw new Error(data.message || "Image upload failed");
  }
  return data;
}

function createEmptyForm() {
  return {
    name: "",
    industry: "",
    offerings: "",
    needs: "",
    tags: "",
    profileText: "",
    videoUrl: "",
    imageFile: null,
  };
}

export default function CompanyInputForm() {
  const [form, setForm] = useState(() => createEmptyForm());
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [errors, setErrors] = useState({});

  function onChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  function onImageChange(e) {
    const file = e.target.files && e.target.files[0] ? e.target.files[0] : null;
    setForm((prev) => ({ ...prev, imageFile: file }));
  }

  function validate() {
    const e = {};
    if (!form.name.trim()) e.name = "Name is required.";
    if (form.offerings && /,,/.test(form.offerings)) e.offerings = "Remove duplicate commas (,).";
    if (form.needs && /,,/.test(form.needs)) e.needs = "Remove duplicate commas (,).";
    if (form.tags && /,,/.test(form.tags)) e.tags = "Remove duplicate commas (,).";
    if (form.videoUrl && !/^https?:\/\//i.test(form.videoUrl.trim())) e.videoUrl = "Use a valid http(s) link.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function onSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setMsg("");
    try {
      if (!validate()) {
        return;
      }
      const res = await fetch(`${API_BASE}/companies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          industry: form.industry,
          offerings: form.offerings
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          needs: form.needs
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          tags: form.tags
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          profileText: form.profileText,
          videoUrl: form.videoUrl.trim(),
        }),
      });
      let created = {};
      try {
        created = await res.json();
      } catch (_) { }
      if (!res.ok) throw new Error(created.message || "failed");
      if (!created || !created._id) {
        throw new Error("Invalid response from server");
      }
      let successMsg = "회사 정보가 저장되었습니다. (기본 이미지 적용)";
      if (form.imageFile) {
        try {
          await uploadCompanyImage(created._id, form.imageFile, form.name);
          successMsg = "회사 정보와 대표 이미지가 저장되었습니다.";
        } catch (uploadErr) {
          successMsg = `회사 정보는 저장되었지만 이미지 업로드에 실패했습니다: ${uploadErr.message}`;
        }
      } else if (form.imageUrl) {
        try {
          await fetch(`${API_BASE}/companies/${created._id}/images`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: form.imageUrl })
          });
          successMsg = "회사 정보와 이미지 URL이 저장되었습니다.";
        } catch (err) {
          successMsg = `회사 정보는 저장되었지만 이미지 URL 저장에 실패했습니다: ${err.message}`;
        }
      }
      setMsg(successMsg);
      setForm(createEmptyForm());
    } catch (error) {
      setMsg(error.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h2>Company</h2>
      <form onSubmit={onSubmit} className="form">
        <Field label="Name" error={errors.name}>
          <TextInput name="name" value={form.name} onChange={onChange} required error={!!errors.name} />
        </Field>
        <Field label="Industry">
          <TextInput name="industry" value={form.industry} onChange={onChange} />
        </Field>
        <Field label="Offerings (comma separated)" error={errors.offerings}>
          <TextInput name="offerings" value={form.offerings} onChange={onChange} error={!!errors.offerings} />
        </Field>
        <Field label="Needs (comma separated)" error={errors.needs}>
          <TextInput name="needs" value={form.needs} onChange={onChange} error={!!errors.needs} />
        </Field>
        <Field label="Tags (comma separated)" error={errors.tags}>
          <TextInput name="tags" value={form.tags} onChange={onChange} error={!!errors.tags} />
        </Field>
        <Field label="Profile">
          <TextArea name="profileText" rows={4} value={form.profileText} onChange={onChange} />
        </Field>
        <Field label="Video URL (YouTube or similar)" hint="Optional" error={errors.videoUrl}>
          <TextInput
            name="videoUrl"
            value={form.videoUrl}
            onChange={onChange}
            error={!!errors.videoUrl}
            placeholder="https://www.youtube.com/watch?v=..."
          />
        </Field>
        <Field label="대표 상품 이미지 업로드" hint="가능하면 최신 이미지를 첨부해 주세요. 미첨부 시 기본 이미지가 사용됩니다.">
          <input name="imageFile" type="file" accept="image/*" onChange={onImageChange} />
        </Field>
        <Field label="Or Image URL" hint="Direct link to an image">
          <TextInput name="imageUrl" value={form.imageUrl || ''} onChange={onChange} placeholder="https://example.com/image.jpg" />
        </Field>
        {msg && <div className="muted">{msg}</div>}
        <Button loading={saving} disabled={saving}>
          {saving ? "Saving..." : "Save"}
        </Button>
      </form>
    </div>
  );
}
