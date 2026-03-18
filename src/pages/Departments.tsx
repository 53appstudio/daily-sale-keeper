import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Department } from '@/db';
import { TAX_CATEGORY_LABELS, type TaxCategory } from '@/lib/tax';
import { AppHeader } from '@/components/AppHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ArrowUp, ArrowDown, Pencil, Trash2, Download, Upload } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function DepartmentsPage() {
  const departments = useLiveQuery(() => db.departments.orderBy('sortOrder').toArray()) ?? [];
  const { toast } = useToast();

  const [newName, setNewName] = useState('');
  const [newTaxCat, setNewTaxCat] = useState<TaxCategory>('standard');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [editName, setEditName] = useState('');
  const [editTaxCat, setEditTaxCat] = useState<TaxCategory>('standard');

  const handleAdd = async () => {
    const name = newName.trim();
    if (!name) { toast({ title: '部門名を入力してください', variant: 'destructive' }); return; }
    if (name.length > 20) { toast({ title: '部門名は20文字以内です', variant: 'destructive' }); return; }
    if (departments.some((d) => d.name === name)) { toast({ title: '同名の部門が既に存在します', variant: 'destructive' }); return; }

    await db.departments.add({
      id: crypto.randomUUID(),
      name,
      defaultTaxCategory: newTaxCat,
      sortOrder: departments.length,
      createdAt: new Date().toISOString(),
    });
    setNewName('');
    toast({ title: `部門「${name}」を追加しました` });
  };

  const handleDelete = async () => {
    if (deletingId) {
      await db.departments.delete(deletingId);
      setDeletingId(null);
      toast({ title: '部門を削除しました' });
    }
  };

  const handleEdit = (dept: Department) => {
    setEditingDept(dept);
    setEditName(dept.name);
    setEditTaxCat(dept.defaultTaxCategory);
  };

  const handleEditSave = async () => {
    if (!editingDept) return;
    const name = editName.trim();
    if (!name || name.length > 20) return;
    if (departments.some((d) => d.name === name && d.id !== editingDept.id)) {
      toast({ title: '同名の部門が既に存在します', variant: 'destructive' });
      return;
    }
    await db.departments.update(editingDept.id, { name, defaultTaxCategory: editTaxCat });
    setEditingDept(null);
    toast({ title: '部門を更新しました' });
  };

  const handleMove = async (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= departments.length) return;
    const a = departments[index];
    const b = departments[targetIndex];
    await db.departments.update(a.id, { sortOrder: b.sortOrder });
    await db.departments.update(b.id, { sortOrder: a.sortOrder });
  };

  const handleCsvExport = () => {
    const header = '部門名,デフォルト税区分';
    const rows = departments.map((d) => `${d.name},${TAX_CATEGORY_LABELS[d.defaultTaxCategory]}`);
    const csv = '\uFEFF' + [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'departments.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCsvImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const text = await file.text();
      const lines = text.split('\n').slice(1).filter((l) => l.trim());
      let count = 0;
      for (const line of lines) {
        const [name] = line.split(',').map((s) => s.trim());
        if (name && name.length <= 20 && !departments.some((d) => d.name === name)) {
          await db.departments.add({
            id: crypto.randomUUID(),
            name,
            defaultTaxCategory: 'standard',
            sortOrder: departments.length + count,
            createdAt: new Date().toISOString(),
          });
          count++;
        }
      }
      toast({ title: `${count}件の部門をインポートしました` });
    };
    input.click();
  };

  const taxCatShort = (cat: TaxCategory) => {
    if (cat === 'standard') return '10%';
    if (cat === 'reduced') return '8%(軽減)';
    return '非課税';
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="container px-4 py-6 max-w-2xl">
        <h2 className="text-xl font-bold mb-6">部門管理</h2>

        <Card className="mb-6">
          <CardContent className="p-6 space-y-4">
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>部門名</Label>
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="新しい部門名"
                  maxLength={20}
                  className="h-12 text-base"
                />
              </div>
              <div className="flex gap-3 items-end">
                <div className="flex-1 space-y-2">
                  <Label>デフォルト税区分</Label>
                  <Select value={newTaxCat} onValueChange={(v) => setNewTaxCat(v as TaxCategory)}>
                    <SelectTrigger className="h-12"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="standard">10%</SelectItem>
                      <SelectItem value="reduced">8%(軽減)</SelectItem>
                      <SelectItem value="exempt">非課税</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button className="h-12 px-6" onClick={handleAdd}>追加</Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            {departments.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">部門が登録されていません</p>
            ) : (
              <div className="space-y-2">
                {departments.map((dept, i) => (
                  <div key={dept.id} className="flex items-center gap-2 py-2 px-3 rounded-md bg-secondary/50">
                    <span className="text-sm text-muted-foreground w-6">{i + 1}.</span>
                    <span className="flex-1 font-medium">{dept.name}</span>
                    <span className="text-sm text-muted-foreground">({taxCatShort(dept.defaultTaxCategory)})</span>
                    <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => handleMove(i, -1)} disabled={i === 0}>
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => handleMove(i, 1)} disabled={i === departments.length - 1}>
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => handleEdit(dept)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive" onClick={() => setDeletingId(dept.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <Separator className="my-4" />
            <div className="flex gap-3">
              <Button variant="outline" className="gap-2" onClick={handleCsvImport}>
                <Upload className="h-4 w-4" /> CSVインポート
              </Button>
              <Button variant="outline" className="gap-2" onClick={handleCsvExport} disabled={departments.length === 0}>
                <Download className="h-4 w-4" /> CSVエクスポート
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>

      {/* Delete confirmation */}
      <AlertDialog open={!!deletingId} onOpenChange={(o) => !o && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>部門を削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>売上データに使用中の場合でも削除できますが、過去の履歴データは部門名を保持します。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>削除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit dialog */}
      <Dialog open={!!editingDept} onOpenChange={(o) => !o && setEditingDept(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>部門の編集</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>部門名</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} maxLength={20} />
            </div>
            <div className="space-y-2">
              <Label>デフォルト税区分</Label>
              <Select value={editTaxCat} onValueChange={(v) => setEditTaxCat(v as TaxCategory)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">10%</SelectItem>
                  <SelectItem value="reduced">8%(軽減)</SelectItem>
                  <SelectItem value="exempt">非課税</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingDept(null)}>キャンセル</Button>
            <Button onClick={handleEditSave}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
