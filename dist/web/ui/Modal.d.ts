type Choice = {
    id: string;
    label: string;
};
type ChoiceResult = {
    type: 'ok';
    selectedIndex: number;
    selectedId: string;
} | {
    type: 'cancel';
};
export declare function isModalOpen(): boolean;
export declare function cancelCurrentModal(): boolean;
export declare function openChoiceModal(params: {
    title: string;
    options: Choice[];
    defaultIndex?: number;
}): Promise<ChoiceResult>;
export {};
//# sourceMappingURL=Modal.d.ts.map