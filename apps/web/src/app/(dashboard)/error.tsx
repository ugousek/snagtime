"use client";
import { Icon } from "@/components/icons";
export default function DashboardError({ reset }: { reset: () => void }) { return <div className="error-state"><span><Icon name="x" /></span><h1>Něco se nenačetlo</h1><p>Vaše data jsou v bezpečí. Zkuste tuto stránku načíst znovu.</p><button className="button button-primary" onClick={reset}>Zkusit znovu</button></div>; }
