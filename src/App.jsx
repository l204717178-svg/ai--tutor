import { WorkspaceLayout } from "@/components/Layout/WorkspaceLayout"
import { StudyView } from "@/components/Study/StudyView"
import { AssignmentView } from "@/components/Assignment/AssignmentView"
import { RevisionView } from "@/components/Revision/RevisionView"
import useFileStore from "@/store/useFileStore"
import { AnimatePresence, motion } from "framer-motion"
import { useEffect } from "react"

function App() {
  const { currentMode } = useFileStore()
  const hydrateFilePoolFromCache = useFileStore((s) => s.hydrateFilePoolFromCache)

  useEffect(() => {
    hydrateFilePoolFromCache()
  }, [hydrateFilePoolFromCache])

  const renderContent = () => {
    switch (currentMode) {
      case 'study':
        return <StudyView />
      case 'assignment':
        return <AssignmentView />
      case 'revision':
        return <RevisionView />
      default:
        return <StudyView />
    }
  }

  return (
    <WorkspaceLayout>
      <AnimatePresence mode="wait">
        <motion.div
          key={currentMode}
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -5 }}
          transition={{ duration: 0.2, ease: "easeInOut" }}
          className="h-full w-full"
        >
          {renderContent()}
        </motion.div>
      </AnimatePresence>
    </WorkspaceLayout>
  )
}

export default App
