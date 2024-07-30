import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "../../components/bs-ui/tabs";

import { useTranslation } from "react-i18next";
import KnowledgeFile from "./KnowledgeFile";
import KnowledgeQa from "./KnowledgeQa";


export default function FileLibPage() {

    const { t } = useTranslation();

    return (
        <div className="w-full h-full px-2 py-4 relative">
            <Tabs defaultValue="qa" className="w-full mb-[40px]">
                <TabsList className="">
                    <TabsTrigger value="qa" className="roundedrounded-xl">{t('lib.qaData')}</TabsTrigger>
                    <TabsTrigger value="file">{t('lib.fileData')}</TabsTrigger>
                </TabsList>
                <TabsContent value="qa">
                    <KnowledgeQa />
                </TabsContent>
                <TabsContent value="file">
                    <KnowledgeFile />
                </TabsContent>
            </Tabs>
        </div>
    );
}