import { useEffect, useState } from 'react'
import { deleteRecognitionItem, listRecognitionItems, saveRecognitionItem } from '../db/repo'

const CATEGORIES = [
  { key: 'person', label: 'People' },
  { key: 'place', label: 'Places' },
  { key: 'thing', label: 'Things' },
]

function emptyForm(category, item) {
  return {
    id: item?.id || '',
    category: item?.category || category,
    question: item?.question || '',
    option1: item?.options?.[0] || '',
    option2: item?.options?.[1] || '',
    option3: item?.options?.[2] || '',
    option4: item?.options?.[3] || '',
    correctAnswer: item?.correctAnswer || '',
    difficulty: item?.difficulty || 'Level 1',
    imageDataUrl: item?.imageDataUrl || item?.imageBlob || '',
    imageName: item?.imageName || '',
    imageMime: item?.imageMime || '',
    name: item?.name || '',
  }
}

export default function RecognitionContentManager({ patientId, role }) {
  const [items, setItems] = useState([])
  const [form, setForm] = useState(null)
  const [deleteId, setDeleteId] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function reload() {
    if (!patientId) return
    setItems(await listRecognitionItems(patientId))
  }

  useEffect(() => {
    reload()
  }, [patientId])

  function updateForm(patch) {
    setForm((current) => ({ ...current, ...patch }))
  }

  function readImage(file) {
    if (!file || !file.type.startsWith('image/')) {
      setError('Please choose an image file only.')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('Image must be smaller than 2 MB.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => updateForm({ imageDataUrl: String(reader.result || ''), imageName: file.name, imageMime: file.type })
    reader.onerror = () => setError('Image could not be loaded.')
    reader.readAsDataURL(file)
  }

  async function save(event) {
    event.preventDefault()
    const options = [form.option1, form.option2, form.option3, form.option4].map((value) => String(value || '').trim())
    if (!form.question.trim() || options.some((option) => !option)) {
      setError('Enter a question and exactly four answer options.')
      return
    }
    if (!options.includes(form.correctAnswer)) {
      setError('Choose the correct answer from the four options.')
      return
    }
    if (!form.imageDataUrl) {
      setError('Please upload an image.')
      return
    }
    await saveRecognitionItem({
      id: form.id || undefined,
      patientId,
      category: form.category,
      kind: form.category,
      name: form.name || form.correctAnswer,
      question: form.question.trim(),
      options,
      correctAnswer: form.correctAnswer,
      difficulty: form.difficulty,
      imageDataUrl: form.imageDataUrl,
      imageName: form.imageName,
      imageMime: form.imageMime,
      createdByRole: role,
    })
    await reload()
    setForm(null)
    setError('')
    setMessage(form.id ? 'Recognition question updated.' : 'Recognition question added.')
  }

  async function remove(id) {
    await deleteRecognitionItem(id)
    await reload()
    setDeleteId('')
    setMessage('Recognition question deleted.')
  }

  return (
    <section className="mt-4 rounded-3xl border border-line bg-paper p-5">
      <h2 className="text-xl font-extrabold">Recognition Content</h2>
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {CATEGORIES.map((category) => {
          const categoryItems = items.filter((item) => (item.category || item.kind) === category.key)
          return (
            <section key={category.key} className="rounded-2xl bg-cream p-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-lg font-extrabold">{category.label}</h3>
                <span className="text-sm font-bold text-muted">{categoryItems.length} saved</span>
              </div>
              <div className="mt-3 grid gap-3">
                {categoryItems.map((item) => (
                  <article key={item.id} className="rounded-xl border border-line bg-paper p-3">
                    {itemImage(item) ? <img src={itemImage(item)} alt={item.name || 'Recognition item'} className="h-24 w-full rounded-lg object-contain" /> : null}
                    <p className="mt-2 font-extrabold">{item.name || item.correctAnswer}</p>
                    <p className="text-sm text-muted">Question: {item.question}</p>
                    <p className="text-sm font-bold text-muted">{item.difficulty}</p>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <button type="button" onClick={() => { setForm(emptyForm(category.key, item)); setError('') }} className="min-h-10 rounded-lg bg-blue text-sm font-extrabold text-white">Edit</button>
                      <button type="button" onClick={() => setDeleteId(item.id)} className="min-h-10 rounded-lg bg-orange text-sm font-extrabold text-white">Delete</button>
                    </div>
                    {deleteId === item.id ? (
                      <div className="mt-2 rounded-lg border-2 border-orange bg-cream p-2">
                        <p className="text-sm font-bold">Delete this recognition question?</p>
                        <div className="mt-2 grid grid-cols-2 gap-2">
                          <button type="button" onClick={() => setDeleteId('')} className="min-h-9 rounded-lg border border-line text-sm font-bold">Cancel</button>
                          <button type="button" onClick={() => remove(item.id)} className="min-h-9 rounded-lg bg-orange text-sm font-bold text-white">Delete</button>
                        </div>
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
              <button type="button" onClick={() => { setForm(emptyForm(category.key)); setError('') }} className="mt-3 min-h-11 w-full rounded-xl bg-green text-sm font-extrabold text-white">+ Add {category.key === 'person' ? 'Person' : category.key === 'place' ? 'Place' : 'Thing'}</button>
            </section>
          )
        })}
      </div>
      {form ? (
        <form onSubmit={save} className="mt-5 rounded-2xl border-2 border-blue bg-cream p-4">
          <h3 className="text-lg font-extrabold">{form.id ? 'Edit recognition question' : 'Add recognition question'}</h3>
          <label className="mt-3 block text-sm font-bold">Category<select value={form.category} onChange={(event) => updateForm({ category: event.target.value })} className="mt-1 min-h-12 w-full rounded-xl border-2 border-line bg-paper px-3 text-lg"><option value="person">Person</option><option value="place">Place</option><option value="thing">Thing</option></select></label>
          <label className="mt-3 block text-sm font-bold">Image<input type="file" accept="image/*" onChange={(event) => readImage(event.target.files?.[0])} className="mt-1 block w-full rounded-xl border-2 border-dashed border-line bg-paper p-2" /></label>
          {form.imageDataUrl ? <img src={form.imageDataUrl} alt="Preview" className="mt-2 h-32 w-full rounded-xl object-contain" /> : null}
          <input required value={form.question} onChange={(event) => updateForm({ question: event.target.value })} placeholder="Question" className="mt-3 min-h-12 w-full rounded-xl border-2 border-line bg-paper px-3 text-lg" />
          <div className="mt-3 grid gap-2 sm:grid-cols-2">{[1, 2, 3, 4].map((number) => <input key={number} required value={form[`option${number}`]} onChange={(event) => updateForm({ [`option${number}`]: event.target.value })} placeholder={`Answer option ${number}`} className="min-h-12 rounded-xl border-2 border-line bg-paper px-3 text-lg" />)}</div>
          <label className="mt-3 block text-sm font-bold">Correct answer<select value={form.correctAnswer} onChange={(event) => updateForm({ correctAnswer: event.target.value })} className="mt-1 min-h-12 w-full rounded-xl border-2 border-line bg-paper px-3 text-lg"><option value="">Select correct answer</option>{[1, 2, 3, 4].map((number) => <option key={number} value={form[`option${number}`]}>Option {number}: {form[`option${number}`] || `Option ${number}`}</option>)}</select></label>
          <label className="mt-3 block text-sm font-bold">Difficulty<select value={form.difficulty} onChange={(event) => updateForm({ difficulty: event.target.value })} className="mt-1 min-h-12 w-full rounded-xl border-2 border-line bg-paper px-3 text-lg">{[1, 2, 3, 4, 5].map((level) => <option key={level} value={`Level ${level}`}>Level {level}</option>)}</select></label>
          {error ? <p className="mt-2 text-sm font-bold text-orange-dark">{error}</p> : null}
          <div className="mt-4 grid grid-cols-2 gap-2"><button type="submit" className="min-h-12 rounded-xl bg-green text-lg font-extrabold text-white">Save</button><button type="button" onClick={() => { setForm(null); setError('') }} className="min-h-12 rounded-xl border-2 border-line text-lg font-extrabold">Cancel</button></div>
        </form>
      ) : null}
      {message ? <p className="mt-3 text-sm font-bold text-green-dark">{message}</p> : null}
    </section>
  )
}

function itemImage(item) {
  return item.imageDataUrl || item.imageBlob || item.imageAsset || ''
}