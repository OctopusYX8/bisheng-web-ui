import throttle from 'lodash-es/throttle';
import * as pdfjsLib from 'pdfjs-dist';
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { FixedSizeList as List, areEqual } from 'react-window';

interface RowProps {
    drawfont: boolean
    index: number
    style: any
    size: number
    labels?: { id: string, label: number[], active: boolean }[]
    pdf: any
    onLoad: (w: number) => void
    onSelectLabel: (data: { id: string, active: boolean }) => void
}
// 绘制一页pdf
const Row = React.memo(({ drawfont, index, style, size, labels, pdf, onLoad, onSelectLabel }: RowProps) => {
    const wrapRef = useRef(null);
    const txtRef = useRef(null);
    // 绘制
    const [scaleState, setScaleState] = useState(1)
    const draw = async () => {
        const page = await pdf.getPage(index + 1); // TODO cache
        const viewport = page.getViewport({ scale: 1 });
        const scale = size / viewport.width;
        setScaleState(scale)
        const canvas = document.createElement('canvas')
        const context = canvas.getContext('2d')
        const outputScale = window.devicePixelRatio || 1;
        canvas.width = Math.floor(viewport.width * scale);
        canvas.height = Math.floor(viewport.height * scale);
        canvas.style.width = Math.floor(viewport.width * scale) + "px";
        canvas.style.height = Math.floor(viewport.height * scale) + "px";
        wrapRef.current.append(canvas)
        const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale,
            0, 0
        ] : null;

        onLoad?.(viewport.width)

        // 渲染页面
        page.render({
            canvasContext: context,
            viewport: page.getViewport({ scale }),
            // transform
        });

        { drawfont && drawText(page, page.getViewport({ scale })) }
    }

    const drawText = async (page, viewport) => {
        page.getTextContent().then(function (textContent) {
            return pdfjsLib.renderTextLayer({
                textContentSource: textContent,
                container: txtRef.current,
                viewport: viewport,
                textDivs: []
            });
        })
    }

    useEffect(() => {
        draw()
        // return () => {};
    }, [])

    return <div className="bg-[#fff] border-b-2 overflow-hidden" style={style}>
        {/* <span className="absolute">{index + 1}</span> */}
        {/* canvas  */}
        <div ref={wrapRef} className="canvasWrapper"></div>
        {/* label */}
        {labels && <svg className="absolute top-0 w-full h-full z-30">
            {labels.map(box =>
                <rect
                    key={box.id}
                    x={box.label[0] * scaleState}
                    y={box.label[1] * scaleState}
                    width={(box.label[2] - box.label[0]) * scaleState}
                    height={(box.label[3] - box.label[1]) * scaleState}
                    style={box.active ?
                        { fill: 'rgba(255, 236, 61, 0.2)', strokeWidth: 1, stroke: '#ffec3d', cursor: 'pointer' }
                        : { fill: 'rgba(0,0,0,0.1)', strokeWidth: 1, stroke: '#333', strokeDasharray: 4, cursor: 'pointer' }}
                    onClick={() => onSelectLabel({ id: box.id, active: !box.active })}
                />
            )}
        </svg>}
        {/* text  */}
        <div ref={txtRef} className="textLayer absolute inset-0 overflow-hidden opacity-25 origin-top-left z-20 leading-none"></div>
    </div>
}, areEqual)

// 拖拽面板
const DragPanne = ({ onMouseEnd }) => {
    const [isDragging, setIsDragging] = useState(false);
    const [startPos, setStartPos] = useState({ x: 0, y: 0 });
    const [currentPos, setCurrentPos] = useState({ x: 0, y: 0 });
    const [isShiftPressed, setIsShiftPressed] = useState(false);
    const boxRef = useRef(null);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Shift') {
                setIsShiftPressed(true);
            }
        };

        const handleKeyUp = (e) => {
            if (e.key === 'Shift') {
                setIsShiftPressed(false);
                setIsDragging(false);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, []);

    useEffect(() => {
        const handleMouseDown = (e) => {
            if (isShiftPressed) {
                const rect = boxRef.current.getBoundingClientRect();
                setIsDragging(true);
                setStartPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
                setCurrentPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
            }
        };

        const handleMouseMove = (e) => {
            if (isDragging) {
                const rect = boxRef.current.getBoundingClientRect();
                setCurrentPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
            }
        };

        const handleMouseUp = () => {
            if (isDragging) {
                setIsDragging(false);
                onMouseEnd(startPos, currentPos)
                // console.log('Selection coordinates:', {
                //     topLeft: startPos,
                //     bottomRight: currentPos,
                // });
            }
        };

        window.addEventListener('mousedown', handleMouseDown);
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);

        return () => {
            window.removeEventListener('mousedown', handleMouseDown);
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isShiftPressed, isDragging, startPos, currentPos, onMouseEnd]);

    return (
        <div
            ref={boxRef}
            className="absolute inset-x-2 inset-y-4 overflow-hidden z-10"
            style={{ pointerEvents: isShiftPressed ? 'auto' : 'none' }}
        >
            {isDragging && (
                <div
                    className="absolute border-2 border-blue-500 bg-blue-100 bg-opacity-25"
                    style={{
                        left: Math.min(startPos.x, currentPos.x),
                        top: Math.min(startPos.y, currentPos.y),
                        width: Math.abs(currentPos.x - startPos.x),
                        height: Math.abs(currentPos.y - startPos.y),
                    }}
                />
            )}
        </div>
    );
};
export default function FileView({ drawfont = false, scrollTo, fileUrl, labels, onSelectLabel }) {
    const { t } = useTranslation()
    const paneRef = useRef(null)
    const listRef = useRef(null)
    const [boxSize, setBoxSize] = useState({ width: 0, height: 0 })
    const [loading, setLoading] = useState(false)

    // 视口
    useEffect(() => {
        const panneDom = paneRef.current;

        const throttledResizeHandler = throttle(entries => {
            if (panneDom) {
                for (let entry of entries) {
                    const [width, height] = [entry.contentRect.width, entry.contentRect.height];
                    setBoxSize({ width, height });
                    const warpDom = document.getElementById('warp-pdf');
                    warpDom.style.setProperty("--scale-factor", width / fileWidthRef.current + '');
                }
            }
        }, 300);

        const resizeObserver = new ResizeObserver(throttledResizeHandler);

        if (panneDom) {
            resizeObserver.observe(panneDom);
        }

        return () => resizeObserver.unobserve(panneDom)
    }, []);
    // 加载文件
    const [pdf, setPdf] = useState(null)
    useEffect(() => {
        // loding
        setLoading(true)

        // sass环境使用sass地址
        const pdfUrl = fileUrl.replace(/https?:\/\/[^\/]+/, __APP_ENV__.BASE_URL);  // '/doc.pdf';
        pdfjsLib.GlobalWorkerOptions.workerSrc = __APP_ENV__.BASE_URL + '/pdf.worker.min.js';
        pdfjsLib.getDocument(pdfUrl).promise.then((pdfDocument) => {
            setLoading(false)
            setPdf(pdfDocument)
        })
    }, [fileUrl])

    const scrollToFunc = (() => {
        const pageY = (scrollTo[0] - 1) * (boxSize.width / 0.7)
        const offsetY = scrollTo[1] * (boxSize.width / fileWidthRef.current) - 100
        listRef.current.scrollTo(pageY + offsetY);
    })
    useEffect(() => {
        scrollTo && scrollToFunc()
    }, [scrollTo])

    const fileWidthRef = useRef(1)
    const handleLoadPage = (w: number) => {
        if (fileWidthRef.current === w) return
        const warpDom = document.getElementById('warp-pdf')
        warpDom.style.setProperty("--scale-factor", boxSize.width / w + '')
        fileWidthRef.current = w
        scrollToFunc()
    }

    const scrollOffsetRef = useRef(0)
    const hanleDragSelectLabel = useCallback((start, end) => {
        let { x, y } = start
        let { x: x1, y: y1 } = end
        const scale = fileWidthRef.current / boxSize.width
        const scroll = scrollOffsetRef.current
        x *= scale
        y = (y + scroll) * scale
        x1 *= scale
        y1 = (y1 + scroll) * scale

        const selects = []
        Object.keys(labels).forEach(key => {
            const pagelabels = labels[key]
            pagelabels.forEach(item => {
                const [sx, sy, ex, ey] = item.label
                const pageH = (key - 1) * (boxSize.width / 0.7 * scale)
                if (x <= sx && y <= sy + pageH && x1 >= ex && y1 >= ey + pageH) {
                    console.log('item.id :>> ', item.id);
                    selects.push({ id: item.id, active: !item.active })
                }
            })
        })
        selects.length && onSelectLabel(selects)
    }, [boxSize, labels])

    return <div ref={paneRef} className="flex-1 h-full bg-gray-100 rounded-md py-4 px-2 relative"
        onContextMenu={(e) => e.preventDefault()}
    >
        {
            loading
                ? <div className="absolute w-full h-full top-0 left-0 flex justify-center items-center z-10 bg-[rgba(255,255,255,0.6)] dark:bg-blur-shared">
                    <span className="loading loading-infinity loading-lg"></span>
                </div>
                : <div id="warp-pdf" className="file-view absolute">
                    <List
                        ref={listRef}
                        itemCount={pdf?.numPages || 100}
                        // A4 比例(itemSize：item的高度)
                        // 595.32 * 841.92 采用宽高比0.70约束
                        itemSize={boxSize.width / 0.7}
                        // 滚动区盒子大小
                        width={boxSize.width}
                        height={boxSize.height}
                        onScroll={val => scrollOffsetRef.current = val.scrollOffset}
                    >
                        {(props) => <Row
                            {...props}
                            drawfont={drawfont}
                            pdf={pdf}
                            size={boxSize.width}
                            labels={labels[props.index + 1]}
                            onLoad={handleLoadPage}
                            onSelectLabel={val => onSelectLabel([val])}
                        ></Row>}
                    </List>
                </div>
        }
        <DragPanne onMouseEnd={hanleDragSelectLabel} />
    </div>
};
