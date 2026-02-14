import React, { useState } from 'react'

interface Skill {
  id: string
  name: string
  description: string
  category: string
  enabled: boolean
  createdAt: number
}

interface SkillPanelProps {
  className?: string
}

export const SkillPanel: React.FC<SkillPanelProps> = ({ className }) => {
  const [skills, setSkills] = useState<Skill[]>([
    {
      id: '1',
      name: 'file-organizer',
      description: '自动整理文件到合适的目录',
      category: '文件管理',
      enabled: true,
      createdAt: Date.now(),
    },
    {
      id: '2',
      name: 'git-commit-helper',
      description: '生成规范的 Git commit message',
      category: '开发工具',
      enabled: true,
      createdAt: Date.now(),
    },
    {
      id: '3',
      name: 'code-reviewer',
      description: '自动审查代码并提供建议',
      category: '开发工具',
      enabled: false,
      createdAt: Date.now(),
    },
  ])
  
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [newSkill, setNewSkill] = useState({
    name: '',
    description: '',
    category: '通用',
    code: '',
  })
  const [filter, setFilter] = useState('')

  const categories = Array.from(new Set(skills.map((s) => s.category)))

  const filteredSkills = skills.filter(
    (s) =>
      s.name.toLowerCase().includes(filter.toLowerCase()) ||
      s.description.toLowerCase().includes(filter.toLowerCase())
  )

  const toggleSkill = (id: string) => {
    setSkills((prev) =>
      prev.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s))
    )
  }

  const deleteSkill = (id: string) => {
    setSkills((prev) => prev.filter((s) => s.id !== id))
    if (selectedSkill?.id === id) {
      setSelectedSkill(null)
    }
  }

  const createSkill = () => {
    if (!newSkill.name.trim()) return

    const skill: Skill = {
      id: crypto.randomUUID(),
      name: newSkill.name,
      description: newSkill.description,
      category: newSkill.category,
      enabled: true,
      createdAt: Date.now(),
    }

    setSkills((prev) => [...prev, skill])
    setIsCreating(false)
    setNewSkill({ name: '', description: '', category: '通用', code: '' })
  }

  const runSkill = async (skill: Skill) => {
    console.log('Running skill:', skill.name)
    // In real implementation, this would call window.electron.skill.run()
  }

  return (
    <div className={`flex h-full bg-gray-900 ${className}`}>
      {/* Sidebar */}
      <div className="w-64 border-r border-gray-800 flex flex-col">
        <div className="p-4 border-b border-gray-800">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Skills</h2>
            <button
              onClick={() => setIsCreating(true)}
              className="p-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
          <input
            type="text"
            placeholder="Search skills..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="flex-1 overflow-y-auto">
          {categories.map((category) => (
            <div key={category}>
              <div className="px-4 py-2 text-xs font-medium text-gray-500 uppercase">
                {category}
              </div>
              {filteredSkills
                .filter((s) => s.category === category)
                .map((skill) => (
                  <button
                    key={skill.id}
                    onClick={() => setSelectedSkill(skill)}
                    className={`w-full px-4 py-3 text-left hover:bg-gray-800 transition-colors ${
                      selectedSkill?.id === skill.id ? 'bg-gray-800 border-l-2 border-blue-500' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-2 h-2 rounded-full ${
                          skill.enabled ? 'bg-green-500' : 'bg-gray-500'
                        }`}
                      />
                      <span className="font-medium truncate">{skill.name}</span>
                    </div>
                  </button>
                ))}
            </div>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {isCreating ? (
          <div className="flex-1 p-6">
            <div className="max-w-2xl">
              <h2 className="text-xl font-semibold mb-6">Create New Skill</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Name</label>
                  <input
                    type="text"
                    value={newSkill.name}
                    onChange={(e) => setNewSkill({ ...newSkill, name: e.target.value })}
                    placeholder="my-skill"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Description</label>
                  <input
                    type="text"
                    value={newSkill.description}
                    onChange={(e) => setNewSkill({ ...newSkill, description: e.target.value })}
                    placeholder="What does this skill do?"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Category</label>
                  <input
                    type="text"
                    value={newSkill.category}
                    onChange={(e) => setNewSkill({ ...newSkill, category: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Code</label>
                  <textarea
                    value={newSkill.code}
                    onChange={(e) => setNewSkill({ ...newSkill, code: e.target.value })}
                    placeholder="// JavaScript code for the skill"
                    rows={10}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 font-mono text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div className="flex gap-4 pt-4">
                  <button
                    onClick={() => setIsCreating(false)}
                    className="px-6 py-2 text-gray-400 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={createSkill}
                    disabled={!newSkill.name.trim()}
                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg font-medium transition-colors"
                  >
                    Create
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : selectedSkill ? (
          <>
            <div className="p-6 border-b border-gray-800">
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="text-2xl font-semibold mb-2">{selectedSkill.name}</h1>
                  <p className="text-gray-400">{selectedSkill.description}</p>
                  <div className="flex items-center gap-4 mt-4">
                    <span className="px-3 py-1 bg-gray-800 rounded-full text-sm">
                      {selectedSkill.category}
                    </span>
                    <span
                      className={`px-3 py-1 rounded-full text-sm ${
                        selectedSkill.enabled
                          ? 'bg-green-900/50 text-green-400'
                          : 'bg-gray-800 text-gray-400'
                      }`}
                    >
                      {selectedSkill.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => runSkill(selectedSkill)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Run
                  </button>
                  <button
                    onClick={() => toggleSkill(selectedSkill.id)}
                    className={`p-2 rounded-lg transition-colors ${
                      selectedSkill.enabled
                        ? 'bg-green-600 hover:bg-green-700'
                        : 'bg-gray-700 hover:bg-gray-600'
                    }`}
                  >
                    {selectedSkill.enabled ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    )}
                  </button>
                  <button
                    onClick={() => deleteSkill(selectedSkill.id)}
                    className="p-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            <div className="flex-1 p-6">
              <div className="bg-gray-800 rounded-lg p-4">
                <h3 className="font-medium mb-4">Skill Configuration</h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-gray-400">Created</label>
                    <div className="mt-1">
                      {new Date(selectedSkill.createdAt).toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <label className="text-sm text-gray-400">ID</label>
                    <div className="mt-1 font-mono text-sm">{selectedSkill.id}</div>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <p>Select a skill to view details</p>
              <p className="text-sm mt-2">or create a new one</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default SkillPanel
