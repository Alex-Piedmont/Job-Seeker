"use client";

import { useCallback, useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useAutoSave } from "@/hooks/use-auto-save";
import { SaveIndicator } from "./save-indicator";
import { fetchOrThrowSaveError } from "@/lib/fetch-with-save-error";
import type { ResumeContact } from "@/types/resume-source";

type ContactFormProps = {
  contact: ResumeContact | null;
  onUpdate: (contact: ResumeContact) => void;
};

type ContactFields = {
  fullName: string;
  email: string;
  phone: string;
  location: string;
  linkedIn: string;
  website: string;
  summary: string;
};

function contactToFields(contact: ResumeContact | null): ContactFields {
  return {
    fullName: contact?.fullName ?? "",
    email: contact?.email ?? "",
    phone: contact?.phone ?? "",
    location: contact?.location ?? "",
    linkedIn: contact?.linkedIn ?? "",
    website: contact?.website ?? "",
    summary: contact?.summary ?? "",
  };
}

export function ContactForm({ contact, onUpdate }: ContactFormProps) {
  const [fields, setFields] = useState<ContactFields>(() =>
    contactToFields(contact)
  );

  useEffect(() => {
    setFields(contactToFields(contact));
  }, [contact]);

  const saveContact = useCallback(
    async (data: ContactFields) => {
      const res = await fetchOrThrowSaveError("/api/resume-source/contact", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: data.fullName,
          email: data.email,
          phone: data.phone || null,
          location: data.location || null,
          linkedIn: data.linkedIn || null,
          website: data.website || null,
          summary: data.summary || null,
        }),
      });
      const saved = await res.json();
      onUpdate(saved);
    },
    [onUpdate]
  );

  const { status, trigger, flush } = useAutoSave({
    onSave: saveContact,
    initialData: contactToFields(contact),
    onRollback: (lastSaved) => setFields(lastSaved),
  });

  const handleChange = (field: keyof ContactFields, value: string) => {
    const updated = { ...fields, [field]: value };
    setFields(updated);
  };

  const handleBlur = () => {
    trigger(fields);
  };

  // Flush on unmount (tab change)
  useEffect(() => {
    return () => flush();
  }, [flush]);

  const fieldConfig: {
    key: keyof ContactFields;
    label: string;
    type?: "textarea";
    placeholder: string;
    required?: boolean;
  }[] = [
    {
      key: "fullName",
      label: "Full Name",
      placeholder: "Alex Rudd",
      required: true,
    },
    {
      key: "email",
      label: "Email",
      placeholder: "alex@example.com",
      required: true,
    },
    { key: "phone", label: "Phone", placeholder: "+1-555-0100" },
    {
      key: "location",
      label: "Location",
      placeholder: "San Francisco, CA",
    },
    {
      key: "linkedIn",
      label: "LinkedIn URL",
      placeholder: "https://linkedin.com/in/yourname",
    },
    {
      key: "website",
      label: "Website URL",
      placeholder: "https://yourwebsite.com",
    },
    {
      key: "summary",
      label: "Professional Summary",
      type: "textarea",
      placeholder: "Senior product manager with 10+ years of experience...",
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Contact Information</h2>
        <SaveIndicator status={status} />
      </div>
      {fieldConfig.map(({ key, label, type, placeholder, required }) => (
        <div key={key} className="space-y-1.5">
          <Label htmlFor={`contact-${key}`}>
            {label}
            {required && <span className="text-destructive ml-1">*</span>}
          </Label>
          {type === "textarea" ? (
            <Textarea
              id={`contact-${key}`}
              value={fields[key]}
              onChange={(e) => handleChange(key, e.target.value)}
              onBlur={handleBlur}
              placeholder={placeholder}
              rows={4}
            />
          ) : (
            <Input
              id={`contact-${key}`}
              value={fields[key]}
              onChange={(e) => handleChange(key, e.target.value)}
              onBlur={handleBlur}
              placeholder={placeholder}
            />
          )}
        </div>
      ))}
    </div>
  );
}
