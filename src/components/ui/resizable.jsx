import * as React from "react"
import { GripVertical } from "lucide-react"
import * as ResizablePrimitive from "react-resizable-panels"

import { cn } from "@/lib/utils"

const ResizablePanelGroup = ({ className, ...props }) => (
    <ResizablePrimitive.Group
        className={cn(
            "flex h-full w-full data-[panel-group-direction=vertical]:flex-col",
            className
        )}
        {...props}
    />
)

const ResizablePanel = ResizablePrimitive.Panel

const ResizableHandle = ({ withHandle, className, ...props }) => (
    <ResizablePrimitive.Separator
        className={cn(
            "relative flex w-1 items-center justify-center bg-border transition-all hover:bg-slate-300 dark:hover:bg-slate-700 active:bg-blue-500 after:absolute after:inset-y-0 after:left-1/2 after:w-4 after:-translate-x-1/2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1 data-[panel-group-direction=vertical]:h-1 data-[panel-group-direction=vertical]:w-full data-[panel-group-direction=vertical]:after:left-0 data-[panel-group-direction=vertical]:after:h-4 data-[panel-group-direction=vertical]:after:w-full data-[panel-group-direction=vertical]:after:-translate-y-1/2 data-[panel-group-direction=vertical]:after:translate-x-0 cursor-col-resize data-[panel-group-direction=vertical]:cursor-row-resize z-50",
            className
        )}
        {...props}>
        {withHandle && (
            <div className="z-10 flex h-4 w-3 items-center justify-center rounded-sm bg-border border border-slate-200 dark:border-slate-800 shadow-sm">
                <GripVertical className="h-2.5 w-2.5 opacity-50" />
            </div>
        )}
    </ResizablePrimitive.Separator>
)

export { ResizablePanelGroup, ResizablePanel, ResizableHandle }
