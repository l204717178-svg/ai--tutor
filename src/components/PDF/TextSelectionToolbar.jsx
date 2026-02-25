import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, MessageSquareQuote } from 'lucide-react';
import { Button } from '@/components/ui/button';
import useFileStore from '@/store/useFileStore';

export function TextSelectionToolbar({ containerRef }) {
    const triggerDirectAIRequest = useFileStore(s => s.triggerDirectAIRequest);
    const setChatInputValue = useFileStore(s => s.setChatInputValue);

    const [selectionInfo, setSelectionInfo] = useState({
        text: '',
        visible: false,
        top: 0,
        left: 0
    });

    const toolbarRef = useRef(null);

    useEffect(() => {
        const handleSelection = () => {
            const selection = window.getSelection();
            if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
                if (selectionInfo.visible) {
                    setSelectionInfo(prev => ({ ...prev, visible: false }));
                }
                return;
            }

            // Clean text: remove multiple newlines and spaces for markdown display
            let text = selection.toString();
            text = text.replace(/[\r\n]+/g, '\n').replace(/[ \t]{2,}/g, ' ').trim();

            if (text.length === 0) {
                if (selectionInfo.visible) {
                    setSelectionInfo(prev => ({ ...prev, visible: false }));
                }
                return;
            }

            const range = selection.getRangeAt(0);
            const rect = range.getBoundingClientRect();

            // Position above the selection center, fixed position
            setSelectionInfo({
                text,
                visible: true,
                top: rect.top - 8,
                left: rect.left + rect.width / 2
            });
        };

        const currentRef = containerRef?.current || document;
        currentRef.addEventListener('mouseup', handleSelection);
        currentRef.addEventListener('keyup', handleSelection); // Support keyboard selection

        // Hide on scroll of the container to prevent floating orphaned toolbar
        const handleScroll = () => {
            if (selectionInfo.visible) {
                setSelectionInfo(prev => ({ ...prev, visible: false }));
                window.getSelection()?.removeAllRanges();
            }
        };
        if (containerRef?.current) {
            containerRef.current.addEventListener('scroll', handleScroll, { passive: true });
        } else {
            window.addEventListener('scroll', handleScroll, { passive: true });
        }

        // Hide if mousedown happens outside
        const handleMouseDown = (e) => {
            if (toolbarRef.current && toolbarRef.current.contains(e.target)) {
                return; // Clicked on the toolbar
            }

            // Allow time for selection to collapse
            setTimeout(() => {
                const sel = window.getSelection();
                if (!sel || sel.isCollapsed) {
                    setSelectionInfo(prev => ({ ...prev, visible: false }));
                }
            }, 10);
        };
        document.addEventListener('mousedown', handleMouseDown);

        return () => {
            currentRef.removeEventListener('mouseup', handleSelection);
            currentRef.removeEventListener('keyup', handleSelection);
            if (containerRef?.current) {
                containerRef.current.removeEventListener('scroll', handleScroll);
            } else {
                window.removeEventListener('scroll', handleScroll);
            }
            document.removeEventListener('mousedown', handleMouseDown);
        };
    }, [containerRef, selectionInfo.visible]);

    const handleExplain = (e) => {
        e.preventDefault();
        e.stopPropagation();

        const prompt = `请用中文详细解释以下这段课件内容，并指出其中的核心概念：\n> ${selectionInfo.text}`;
        triggerDirectAIRequest(prompt);

        setSelectionInfo(prev => ({ ...prev, visible: false }));
        window.getSelection()?.removeAllRanges();
    };

    const handleAskAI = (e) => {
        e.preventDefault();
        e.stopPropagation();

        const prompt = `> ${selectionInfo.text}\n\n`;
        setChatInputValue(prompt);

        setSelectionInfo(prev => ({ ...prev, visible: false }));
        window.getSelection()?.removeAllRanges();
    };

    if (!selectionInfo.visible) return null;

    return (
        <div
            ref={toolbarRef}
            className="fixed z-[100] shadow-xl border border-border/40 bg-background/95 backdrop-blur-lg rounded-full px-1.5 py-1.5 flex items-center gap-1 animate-in fade-in zoom-in-95 duration-100"
            style={{
                top: `${selectionInfo.top}px`,
                left: `${selectionInfo.left}px`,
                transform: 'translate(-50%, -100%)'
            }}
        >
            <Button
                variant="ghost"
                size="sm"
                onClick={handleExplain}
                className="h-8 rounded-full text-xs px-3 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/30 transition-colors"
            >
                <Sparkles className="w-3.5 h-3.5 mr-1.5 text-blue-500" />
                解释
            </Button>
            <div className="w-[1px] h-4 bg-border/50 mx-0.5"></div>
            <Button
                variant="ghost"
                size="sm"
                onClick={handleAskAI}
                className="h-8 rounded-full text-xs px-3 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-900/30 transition-colors"
            >
                <MessageSquareQuote className="w-3.5 h-3.5 mr-1.5 text-indigo-500" />
                问 AI
            </Button>
        </div>
    );
}
